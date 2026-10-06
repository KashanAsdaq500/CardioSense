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

gemini = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_PUBLISHABLE_KEY")
)


# --------------------------------------------------
# Load local knowledge index
# --------------------------------------------------

script_dir = Path(__file__).resolve().parent
knowledge_path = script_dir / "knowledge_base.json"

KNOWLEDGE_INDEX = {}
if knowledge_path.exists():
    with open(knowledge_path, "r", encoding="utf-8") as f:
        for rec in json.load(f):
            KNOWLEDGE_INDEX[rec.get("id")] = rec
            KNOWLEDGE_INDEX[rec.get("topic")] = rec


# --------------------------------------------------
# Test query
# --------------------------------------------------

query = (
    "What is myocardial infarction and "
    "what should be considered when interpreting "
    "an ECG related to myocardial infarction?"
)


# --------------------------------------------------
# Create query embedding
# --------------------------------------------------

result = gemini.models.embed_content(
    model="gemini-embedding-2",
    contents=query,
    config=types.EmbedContentConfig(
        output_dimensionality=768
    )
)

query_embedding = result.embeddings[0].values


# --------------------------------------------------
# Supabase vector search
# --------------------------------------------------

response = supabase.rpc(
    "match_ecg_knowledge",
    {
        "query_embedding": query_embedding,
        "match_count": 3
    }
).execute()


# --------------------------------------------------
# Display results
# --------------------------------------------------

print()
print("RAG RETRIEVAL RESULTS WITH EVIDENCE METADATA")
print("=" * 65)

for item in response.data:
    item_id = item.get("id")
    topic = item.get("topic")
    local_meta = KNOWLEDGE_INDEX.get(item_id) or KNOWLEDGE_INDEX.get(topic) or {}

    source_name = item.get("source_name") or local_meta.get("source_name")
    source_org = item.get("source_organization") or local_meta.get("source_organization")
    source_title = item.get("source_title") or local_meta.get("source_title")
    source_url = item.get("source_url") or local_meta.get("source_url")
    pub_year = item.get("publication_year") or local_meta.get("publication_year")

    print()
    print("Topic:       ", topic)
    print("Class:       ", item.get("class"))
    print("Similarity:  ", round(item["similarity"], 4))
    print("Source:      ", f"{source_name} ({pub_year})")
    print("Organization:", source_org)
    print("Title:       ", source_title)
    print("Official URL:", source_url)
    print("Content:     ", item["content"])