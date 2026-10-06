-- ====================================================================
-- CardioSense RAG Evidence Sources & Metadata Migration
-- Execute this script in your Supabase SQL Editor.
-- ====================================================================

-- 1. Add source metadata columns to ecg_knowledge table (preserving existing records)
ALTER TABLE ecg_knowledge
ADD COLUMN IF NOT EXISTS source_name text,
ADD COLUMN IF NOT EXISTS source_organization text,
ADD COLUMN IF NOT EXISTS source_title text,
ADD COLUMN IF NOT EXISTS source_url text,
ADD COLUMN IF NOT EXISTS source_type text,
ADD COLUMN IF NOT EXISTS publication_year integer;

-- 2. Update vector search match_ecg_knowledge function to return source metadata
CREATE OR REPLACE FUNCTION match_ecg_knowledge (
  query_embedding vector(768),
  match_count int DEFAULT 4
)
RETURNS TABLE (
  id text,
  topic text,
  class text,
  content text,
  similarity float,
  source_name text,
  source_organization text,
  source_title text,
  source_url text,
  source_type text,
  publication_year integer
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ecg_knowledge.id,
    ecg_knowledge.topic,
    ecg_knowledge.class,
    ecg_knowledge.content,
    1 - (ecg_knowledge.embedding <=> query_embedding) AS similarity,
    ecg_knowledge.source_name,
    ecg_knowledge.source_organization,
    ecg_knowledge.source_title,
    ecg_knowledge.source_url,
    ecg_knowledge.source_type,
    ecg_knowledge.publication_year
  FROM ecg_knowledge
  ORDER BY ecg_knowledge.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
