import base64
import io
import os
from pathlib import Path
import tempfile
import uuid

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from starlette.concurrency import run_in_threadpool
from supabase import create_client, Client

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms

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

MODEL_FILENAME = "cardiosense_resnet18.pth"
MODEL_BUCKET = os.getenv("SUPABASE_MODEL_BUCKET", "cardiosense-model")
LOCAL_MODEL_PATH = BASE_DIR / "models" / MODEL_FILENAME
CACHE_MODEL_PATH = Path(tempfile.gettempdir()) / MODEL_FILENAME

GRADCAM_DIR = (
    BASE_DIR
    / "backend"
    / "gradcam_outputs"
)

try:
    GRADCAM_DIR.mkdir(
        parents=True,
        exist_ok=True
    )
except Exception:
    # Read-only or ephemeral runtime environment
    pass


# --------------------------------------------------
# Device
# --------------------------------------------------

device = torch.device(
    "cuda"
    if torch.cuda.is_available()
    else "cpu"
)


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
    Resolves the location of the ResNet18 model checkpoint:
    1. Local filesystem: If models/cardiosense_resnet18.pth exists (development), use it directly.
    2. Warm instance cache: If tempfile cache exists, reuse it without downloading.
    3. Cold start: Download securely from private Supabase Storage bucket using server credentials,
       and write to tempfile cache.
    """
    if LOCAL_MODEL_PATH.exists():
        return LOCAL_MODEL_PATH

    if CACHE_MODEL_PATH.exists() and CACHE_MODEL_PATH.stat().st_size > 0:
        return CACHE_MODEL_PATH

    print(f"[MODEL INIT] Downloading '{MODEL_FILENAME}' from private Supabase Storage bucket '{MODEL_BUCKET}'...")

    # Use service role key if available for server-side private bucket access, otherwise fallback to publishable key
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

checkpoint = torch.load(
    resolved_model_path,
    map_location=device
)

model = models.resnet18(
    weights=None
)

num_features = model.fc.in_features

model.fc = nn.Linear(
    num_features,
    len(class_names)
)

model.load_state_dict(
    checkpoint["model_state_dict"]
)

model = model.to(device)

model.eval()


# --------------------------------------------------
# Image preprocessing
# --------------------------------------------------

transform = transforms.Compose([
    transforms.Resize((448, 320)),

    transforms.ToTensor(),

    transforms.Normalize(
        mean=[
            0.485,
            0.456,
            0.406
        ],
        std=[
            0.229,
            0.224,
            0.225
        ]
    )
])


# --------------------------------------------------
# Grad-CAM
# --------------------------------------------------

gradcam_activations = None
gradcam_gradients = None


def forward_hook(
    module,
    input,
    output
):
    global gradcam_activations

    gradcam_activations = output


def backward_hook(
    module,
    grad_input,
    grad_output
):
    global gradcam_gradients

    gradcam_gradients = grad_output[0]


target_layer = model.layer4[-1].conv2

forward_handle = target_layer.register_forward_hook(
    forward_hook
)

backward_handle = target_layer.register_full_backward_hook(
    backward_hook
)


def generate_gradcam(
    image: Image.Image,
    predicted_index: int
):

    global gradcam_activations
    global gradcam_gradients

    input_tensor = transform(
        image
    ).unsqueeze(0).to(device)

    model.zero_grad()

    output = model(
        input_tensor
    )

    score = output[
        0,
        predicted_index
    ]

    score.backward()

    if (
        gradcam_activations is None
        or gradcam_gradients is None
    ):
        raise RuntimeError(
            "Grad-CAM hooks did not capture activations or gradients."
        )

    activations = (
        gradcam_activations.detach()
    )

    gradients = (
        gradcam_gradients.detach()
    )

    weights = gradients.mean(
        dim=(2, 3),
        keepdim=True
    )

    cam = (
        weights * activations
    ).sum(
        dim=1,
        keepdim=True
    )

    cam = F.relu(cam)

    cam = cam - cam.min()

    cam = cam / (
        cam.max() + 1e-8
    )

    cam = F.interpolate(
        cam,
        size=image.size[::-1],
        mode="bilinear",
        align_corners=False
    )

    return cam.squeeze().cpu().numpy()


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
        "device": str(device)
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
        # Model prediction
        # ------------------------------------------

        input_tensor = transform(
            image
        ).unsqueeze(0).to(device)

        model.zero_grad()

        output = model(
            input_tensor
        )

        probabilities = torch.softmax(
            output,
            dim=1
        )

        predicted_index = torch.argmax(
            probabilities,
            dim=1
        ).item()

        confidence = probabilities[
            0,
            predicted_index
        ].item()

        prediction = class_names[
            predicted_index
        ]


        # ------------------------------------------
        # Generate Grad-CAM
        # ------------------------------------------

        heatmap = generate_gradcam(
            image,
            predicted_index
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









