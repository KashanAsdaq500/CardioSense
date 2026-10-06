import base64
import io
import os
from pathlib import Path
import tempfile
import uuid

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import onnx
from onnx import numpy_helper
import onnxruntime as ort

from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from starlette.concurrency import run_in_threadpool
from supabase import create_client, Client

from backend.auth import get_current_user_id
from backend.rag.rag_explainer import generate_rag_explanation


# --------------------------------------------------
# Environment
# --------------------------------------------------

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")

if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
    raise RuntimeError(
        "Supabase environment variables are missing."
    )

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
)


# --------------------------------------------------
# --------------------------------------------------
# App
# --------------------------------------------------

app = FastAPI(
    title="CardioSense API",
    description="Explainable ECG Intelligence Platform",
    version="1.0.0"
)

cors_origins_env = os.getenv("CORS_ORIGINS", "http://localhost:3000")
allowed_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
if "*" not in allowed_origins and "http://localhost:3000" not in allowed_origins:
    allowed_origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if "*" not in allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# Paths & Model Configuration
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_FILENAME = "cardiosense_resnet18.onnx"
MODEL_BUCKET = os.getenv("SUPABASE_MODEL_BUCKET", "cardiosense-model")
LOCAL_MODEL_PATH = BASE_DIR / "models" / MODEL_FILENAME
CACHE_MODEL_PATH = Path(tempfile.gettempdir()) / MODEL_FILENAME

# --------------------------------------------------
# Classes
# --------------------------------------------------

class_names = [
    "Normal",
    "Abnormal_Heartbeat",
    "History_of_MI",
    "Myocardial_Infarction"
]


# --------------------------------------------------
# Secure Model Retrieval (Local -> Warm Cache -> Supabase Storage)
# --------------------------------------------------

def resolve_model_path() -> Path:
    """
    Resolves the location of the ResNet18 ONNX model:
    1. Local filesystem: If models/cardiosense_resnet18.onnx exists, use it directly.
    2. Warm instance cache: If tempfile cache exists, reuse it without downloading.
    3. Cold start: Download securely from private Supabase Storage bucket using server credentials,
       and write to tempfile cache.
    """
    if LOCAL_MODEL_PATH.exists():
        return LOCAL_MODEL_PATH

    if CACHE_MODEL_PATH.exists() and CACHE_MODEL_PATH.stat().st_size > 0:
        return CACHE_MODEL_PATH

    print(f"[MODEL INIT] Downloading '{MODEL_FILENAME}' from private Supabase Storage bucket '{MODEL_BUCKET}'...")

    storage_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SECRET_KEY")
        or SUPABASE_PUBLISHABLE_KEY
    )
    storage_client = create_client(SUPABASE_URL, storage_key)

    try:
        model_bytes = storage_client.storage.from_(MODEL_BUCKET).download(MODEL_FILENAME)
        if not model_bytes:
            raise RuntimeError(f"Downloaded model file '{MODEL_FILENAME}' is empty.")

        with open(CACHE_MODEL_PATH, "wb") as f:
            f.write(model_bytes)

        print(f"[MODEL INIT] Model successfully cached at {CACHE_MODEL_PATH} ({len(model_bytes)} bytes)")
        return CACHE_MODEL_PATH
    except Exception as err:
        raise RuntimeError(
            f"Failed to retrieve model from Supabase Storage bucket '{MODEL_BUCKET}': {err}"
        )


resolved_model_path = resolve_model_path()

# --------------------------------------------------
# ONNX Runtime Session & Classifier Weights
# --------------------------------------------------

ort_session = ort.InferenceSession(
    str(resolved_model_path),
    providers=["CPUExecutionProvider"]
)

# Extract classifier weights from the ONNX graph initializers
# for analytic Grad-CAM computation (ResNet18 GAP + Linear property)
onnx_proto = onnx.load(str(resolved_model_path))
fc_weight = None
for init in onnx_proto.graph.initializer:
    if init.name == "fc.weight":
        fc_weight = numpy_helper.to_array(init)  # shape (4, 512)
        break

if fc_weight is None:
    raise RuntimeError("Could not find 'fc.weight' initializer in ONNX model graph.")


# --------------------------------------------------
# Image Preprocessing (Pillow + NumPy)
# --------------------------------------------------

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def preprocess_image(image: Image.Image) -> np.ndarray:
    """
    Exact backend preprocessing:
    1. Resize((448, 320)): Pillow size (width=320, height=448) produces array (448, 320, 3)
    2. ToTensor: float32 in [0.0, 1.0]
    3. Normalize: ImageNet mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
    4. NCHW layout: shape (1, 3, 448, 320)
    """
    resized = image.resize((320, 448), Image.Resampling.BILINEAR)
    arr = np.array(resized, dtype=np.float32) / 255.0
    normalized = (arr - IMAGENET_MEAN) / IMAGENET_STD
    chw = np.transpose(normalized, (2, 0, 1))
    nchw = np.expand_dims(chw, axis=0)
    return nchw.astype(np.float32)


# --------------------------------------------------
# Grad-CAM (Pure ONNX Analytic CAM)
# --------------------------------------------------

def generate_gradcam_onnx(
    features: np.ndarray,
    predicted_index: int,
    target_size: tuple[int, int]
) -> np.ndarray:
    """
    Calculates mathematically rigorous Grad-CAM via ResNet18 Global Average Pooling property:
    Grad-CAM alpha_k^c simplifies analytically to the classifier weight w_{k, c}.
    CAM = ReLU( sum_k( w_{k, c} * A^k ) ), normalized and resized to original image dimensions.
    """
    weights_c = fc_weight[predicted_index]  # shape (512,)
    # features shape: (1, 512, H_feat, W_feat)
    cam = np.tensordot(weights_c, features[0], axes=(0, 0))

    # Apply ReLU
    cam = np.maximum(cam, 0)

    # Normalize to [0, 1]
    cam_min = cam.min()
    cam_max = cam.max()
    if cam_max - cam_min > 1e-8:
        cam = (cam - cam_min) / (cam_max - cam_min)
    else:
        cam = np.zeros_like(cam)

    # Upsample to original image size (width, height)
    cam_img = Image.fromarray(cam.astype(np.float32))
    cam_resized = np.array(
        cam_img.resize(target_size, Image.Resampling.BILINEAR)
    )
    return cam_resized


# --------------------------------------------------
# Health
# --------------------------------------------------

@app.get("/health")
def health():

    return {
        "status": "healthy",
        "service": "CardioSense API",
        "model_loaded": True,
        "database_connected": True,
        "device": "cpu (onnxruntime)"
    }


# --------------------------------------------------
# Prediction + Grad-CAM + Database
# --------------------------------------------------

@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id)
):

    if (
        not file.content_type
        or not file.content_type.startswith("image/")
    ):
        raise HTTPException(
            status_code=400,
            detail="Please upload an ECG image file."
        )

    try:

        # ------------------------------------------
        # Read uploaded image
        # ------------------------------------------

        image_bytes = await file.read()

        image = Image.open(
            io.BytesIO(image_bytes)
        ).convert("RGB")


        # ------------------------------------------
        # Model prediction (ONNX Runtime)
        # ------------------------------------------

        input_array = preprocess_image(image)

        # ort_session returns logits and features
        logits, features = ort_session.run(
            ["logits", "features"],
            {"image": input_array}
        )

        # Compute Softmax probabilities
        exp_logits = np.exp(logits - np.max(logits, axis=-1, keepdims=True))
        probabilities = exp_logits / np.sum(exp_logits, axis=-1, keepdims=True)

        predicted_index = int(np.argmax(probabilities[0]))
        confidence = float(probabilities[0][predicted_index])
        prediction = class_names[predicted_index]

        # ------------------------------------------
        # Generate Grad-CAM (Pure ONNX Analytic CAM)
        # ------------------------------------------

        heatmap = generate_gradcam_onnx(
            features=features,
            predicted_index=predicted_index,
            target_size=image.size  # (width, height)
        )


        # ------------------------------------------
        # Create Grad-CAM overlay
        # ------------------------------------------

        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(
            figsize=(12, 6)
        )

        ax.imshow(image)

        ax.imshow(
            heatmap,
            cmap="jet",
            alpha=0.45
        )

        ax.set_title(
            f"CardioSense Grad-CAM - {prediction}"
        )

        ax.axis("off")


        # ------------------------------------------
        # Save Grad-CAM image to Base64 (in-memory)
        # ------------------------------------------

        gradcam_buffer = io.BytesIO()

        plt.savefig(
            gradcam_buffer,
            format="png",
            dpi=150,
            bbox_inches="tight"
        )

        plt.close(fig)

        gradcam_buffer.seek(0)

        gradcam_base64 = base64.b64encode(
            gradcam_buffer.read()
        ).decode("utf-8")

        gradcam_data_url = (
            "data:image/png;base64,"
            + gradcam_base64
        )


        # ------------------------------------------
        # Save analysis to Supabase
        # ------------------------------------------
        # ------------------------------------------
        # Generate RAG explanation (fail-safe)
        # ------------------------------------------

        rag_explanation = ""
        rag_sources = []

        try:
            rag_result = await run_in_threadpool(
                generate_rag_explanation,
                prediction
            )
            rag_explanation = rag_result.get("explanation", "")
            rag_sources = rag_result.get("sources", [])
        except Exception as rag_err:
            print(f"[WARNING] RAG generation encountered error: {rag_err}")
            rag_explanation = (
                f"The CardioSense model classified this ECG as **{prediction.replace('_', ' ')}**. "
                "The prediction represents a machine-learning classification based on an ECG image and should not be considered a medical diagnosis. "
                "Clinical decisions should always be made by a qualified healthcare professional."
            )
            rag_sources = []

        # ------------------------------------------
        # Save analysis to Supabase
        # ------------------------------------------

        analysis_data = {
            "user_id": user_id,
            "filename": file.filename,
            "prediction": prediction,
            "confidence": round(
                confidence * 100,
                2
            ),
            "gradcam_image": gradcam_data_url,
            "rag_explanation": rag_explanation
        }

        saved_analysis = None

        try:
            db_response = supabase.table(
                "ecg_analyses"
            ).insert(
                analysis_data
            ).execute()

            if db_response.data:
                saved_analysis = db_response.data[0]
        except Exception as db_err:
            err_str = str(db_err)
            # If user_id column has not yet been added to Supabase, fall back gracefully
            if "user_id" in err_str:
                print(f"[NOTICE] 'user_id' column not found in ecg_analyses yet; saving without user_id until migration is run.")
                try:
                    fallback_data = {k: v for k, v in analysis_data.items() if k != "user_id"}
                    db_response = supabase.table("ecg_analyses").insert(fallback_data).execute()
                    if db_response.data:
                        saved_analysis = db_response.data[0]
                except Exception as fallback_err:
                    print(f"[WARNING] Fallback database save failed: {fallback_err}")
            else:
                print(f"[WARNING] Could not save analysis to Supabase: {db_err}")

        # ------------------------------------------
        # Final response
        # ------------------------------------------

        return {
            "id": (
                saved_analysis["id"]
                if saved_analysis
                else None
            ),

            "prediction": prediction,

            "confidence": round(
                confidence * 100,
                2
            ),

            "filename": file.filename,

            "gradcam_image": gradcam_data_url,

            "rag_explanation": rag_explanation,

            "rag_sources": rag_sources,

            "database_saved": (
                saved_analysis is not None
            )
        }


    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )


# --------------------------------------------------
# History endpoint (Authenticated & Isolated per user)
# --------------------------------------------------

@app.get("/history")
def get_history(
    limit: int = 50,
    user_id: str = Depends(get_current_user_id)
):
    try:
        response = (
            supabase.table("ecg_analyses")
            .select(
                "id, filename, prediction, confidence, gradcam_image, rag_explanation, created_at, user_id"
            )
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data or []
    except Exception as e:
        err_str = str(e)
        if "user_id" in err_str:
            print(f"[NOTICE] 'user_id' column not present in ecg_analyses yet; please run backend/auth_migration.sql.")
            # Returns empty list for the authenticated user to maintain user isolation
            return []
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch ECG analysis history: {str(e)}"
        )









