import json
import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types
from supabase import create_client


# --------------------------------------------------
# Environment
# --------------------------------------------------

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is missing.")

if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
    raise RuntimeError("Supabase environment variables are missing.")


# --------------------------------------------------
# Clients
# --------------------------------------------------

gemini = genai.Client(api_key=GEMINI_API_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)


# --------------------------------------------------
# Knowledge base
# --------------------------------------------------

script_dir = Path(__file__).resolve().parent
knowledge_path = script_dir / "knowledge_base.json"

with open(knowledge_path, "r", encoding="utf-8") as file:
    knowledge_base = json.load(file)

print(f"Loaded {len(knowledge_base)} knowledge records from {knowledge_path}")


# --------------------------------------------------
# Generate embeddings & Upsert
# --------------------------------------------------

metadata_supported = True

for item in knowledge_base:

    text = item["content"]

    result = gemini.models.embed_content(
        model="gemini-embedding-2",
        contents=text,
        config=types.EmbedContentConfig(
            output_dimensionality=768
        )
    )

    embedding = result.embeddings[0].values

    print(
        f"{item['id']}: embedding size = {len(embedding)}"
    )

    row = {
        "id": item["id"],
        "topic": item["topic"],
        "class": item.get("class"),
        "content": item["content"],
        "embedding": embedding,
        "source_name": item.get("source_name"),
        "source_organization": item.get("source_organization"),
        "source_title": item.get("source_title"),
        "source_url": item.get("source_url"),
        "source_type": item.get("source_type"),
        "publication_year": item.get("publication_year"),
    }

    try:
        supabase.table("ecg_knowledge").upsert(row).execute()
    except Exception as e:
        err_msg = str(e)
        if "source_name" in err_msg or "PGRST204" in err_msg:
            if metadata_supported:
                print(
                    "\n[NOTE] Metadata columns not yet present in Supabase table."
                )
                print(
                    "Execute backend/rag/migration.sql in your Supabase SQL editor to add the columns to PostgreSQL."
                )
                metadata_supported = False
            core_row = {
                "id": item["id"],
                "topic": item["topic"],
                "class": item.get("class"),
                "content": item["content"],
                "embedding": embedding,
            }
            supabase.table("ecg_knowledge").upsert(core_row).execute()
        else:
            raise

print()
if metadata_supported:
    print(
        f"Successfully embedded and stored {len(knowledge_base)} records with source metadata in Supabase."
    )
else:
    print(
        f"Successfully embedded {len(knowledge_base)} knowledge records into Supabase."
    )