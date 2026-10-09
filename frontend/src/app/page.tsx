"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { useAuth, UserButton } from "@clerk/nextjs";
import { CardioSenseLogo } from "./components/CardioSenseLogo";

type RagSource = {
  topic: string;
  class: string | null;
  similarity: number;
  source_name?: string;
  source_organization?: string;
  source_title?: string;
  source_url?: string;
  source_type?: string;
  publication_year?: number;
};

type PredictionResult = {
  id: string | null;
  prediction: string;
  confidence: number;
  filename: string;
  gradcam_image: string;
  database_saved: boolean;
  rag_explanation: string;
  rag_sources: RagSource[];
};

function formatPrediction(prediction: string): string {
  switch (prediction) {
    case "Normal":
      return "Normal";
    case "Abnormal_Heartbeat":
      return "Abnormal Heartbeat";
    case "History_of_MI":
      return "History of MI";
    case "Myocardial_Infarction":
      return "Myocardial Infarction";
    default:
      return prediction.replaceAll("_", " ");
  }
}

export default function Home() {
  const { getToken, isSignedIn } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manage object URL lifecycle for uploaded image preview
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  function handleFileSelect(selectedFile: File | null) {
    setFile(selectedFile);
    setResult(null);
    setError("");
  }

  async function analyzeECG() {
    if (!file) {
      setError("Please select an ECG image first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const formData = new FormData();
      formData.append("file", file);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`/api/backend/predict`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Session expired or authentication required. Please sign in again.");
        }
        throw new Error("ECG analysis failed.");
      }

      const data: PredictionResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while analyzing the ECG."
      );
    } finally {
      setLoading(false);
    }
  }

  const predictionLabel = result ? formatPrediction(result.prediction) : "";
  const isNormal = result?.prediction.toLowerCase() === "normal";

  // Dynamic status styling based on model classification
  const dynamicStyles = isNormal
    ? {
        text: "text-emerald-700",
        badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
        dot: "bg-emerald-600",
        boxBg: "bg-emerald-50/70",
        boxBorder: "border-emerald-200",
        confidenceValue: "text-emerald-700",
        statusText: "Normal Rhythm Pattern",
      }
    : {
        text: "text-red-700",
        badge: "bg-red-50 text-red-800 border-red-200",
        dot: "bg-red-600",
        boxBg: "bg-red-50/70",
        boxBorder: "border-red-200",
        confidenceValue: "text-red-700",
        statusText: "Abnormality Detected",
      };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* INSTITUTIONAL CLINICAL HEADER */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-xs sticky top-0 z-30 shadow-xs">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardioSenseLogo className="h-10 w-10 shrink-0" variant="badge" />
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-base font-bold tracking-[0.16em] text-slate-900 leading-none">
                  CARDIOSENSE
                </span>
                <span className="hidden sm:inline-block rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-700 uppercase tracking-wider ml-1">
                  Clinical AI
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-1">
                Explainable ECG Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <Link
                href="/"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-white text-red-700 shadow-xs border border-slate-200/60 transition-all"
              >
                Analyze
              </Link>
              <Link
                href="/history"
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white/80 transition-all"
              >
                History
              </Link>
            </nav>

            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Inference Engine Active
            </span>

            <div className="pl-1 border-l border-slate-200 flex items-center">
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: "h-8 w-8 ring-2 ring-slate-200 hover:ring-red-400 transition-all",
                  },
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 mx-auto max-w-6xl w-full px-4 sm:px-6 py-8 sm:py-10">
        {/* HERO SECTION */}
        <section className="mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-semibold uppercase tracking-wider mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
            Diagnostic Interpretability Platform
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">
            CARDIOSENSE
          </h1>

          <p className="text-lg sm:text-xl font-semibold text-slate-700 mt-1">
            Explainable ECG Intelligence
          </p>

          <p className="mt-3 max-w-3xl text-sm sm:text-base leading-relaxed text-slate-600">
            Upload an ECG image to get an AI-based classification, visual explanation with Grad-CAM, and evidence-grounded clinical context.
          </p>
        </section>

        {/* WORKSTATION GRID: UPLOAD & RESULTS */}
        <div className="grid gap-6 lg:grid-cols-[1fr_1.35fr] items-start">
          {/* UPLOAD CARD */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Analyze ECG
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Select an ECG image in JPG or PNG format.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md font-mono">
                <svg className="h-3.5 w-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>JPG / PNG</span>
              </div>
            </div>

            {/* CLINICAL IMAGING DROPZONE */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const droppedFile = e.dataTransfer.files?.[0] ?? null;
                if (droppedFile) {
                  handleFileSelect(droppedFile);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-5 cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                isDragging
                  ? "border-red-500 bg-red-50/50"
                  : file
                  ? "border-slate-300 bg-slate-50/60 hover:border-red-400 hover:bg-red-50/20"
                  : "border-slate-300 bg-slate-50/40 hover:border-red-400 hover:bg-red-50/20"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(event) => {
                  handleFileSelect(event.target.files?.[0] ?? null);
                }}
              />

              {previewUrl && file ? (
                <div className="flex flex-col items-center">
                  <div className="relative max-h-40 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs p-1">
                    <img
                      src={previewUrl}
                      alt="Selected ECG"
                      className="mx-auto max-h-36 object-contain"
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="font-medium text-sm text-slate-800 truncate max-w-xs">
                      {file.name}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      ({(file.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <span className="mt-1 text-xs text-red-700 font-medium hover:underline">
                    Click to choose another image
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 border border-red-200 text-red-700 mb-3 shadow-xs">
                    {/* ECG/heart icon */}
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l2-3 3 6 2-3h7" />
                    </svg>
                  </div>

                  <span className="text-sm font-semibold text-slate-800">
                    Upload ECG image
                  </span>

                  <span className="mt-1 text-xs text-slate-500">
                    Drag and drop file here, or click to browse
                  </span>

                  <span className="mt-2 inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    JPG or PNG
                  </span>
                </div>
              )}
            </div>

            {/* ACTION BUTTON */}
            <button
              onClick={analyzeECG}
              disabled={!file || loading}
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-red-700 px-5 py-3.5 font-semibold text-white shadow-xs transition-colors hover:bg-red-800 active:bg-red-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Analyzing ECG...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Analyze ECG</span>
                </>
              )}
            </button>

            {/* ERROR NOTIFICATION */}
            {error && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <svg className="h-5 w-5 text-red-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="leading-snug">
                  <p className="font-semibold text-red-900">Analysis Error</p>
                  <p className="mt-0.5 text-xs text-red-700">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* RESULTS CARD / DASHBOARD */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
            {/* EMPTY STATE */}
            {!result && !loading && (
              <div className="flex min-h-[440px] flex-col items-center justify-center text-center p-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 border border-slate-200 shadow-xs mb-4">
                  <CardioSenseLogo className="h-10 w-10" variant="plain" />
                </div>
                <h3 className="text-base font-semibold text-slate-800">
                  Awaiting ECG Analysis
                </h3>
                <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">
                  Your analysis results will appear here after selecting an ECG image and clicking &ldquo;Analyze ECG&rdquo;.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2 text-[11px] text-slate-500 font-medium">
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 border border-slate-200">
                    Model Classification
                  </span>
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 border border-slate-200">
                    Grad-CAM Heatmap
                  </span>
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 border border-slate-200">
                    Evidence-Grounded RAG
                  </span>
                </div>
              </div>
            )}

            {/* LOADING STATE */}
            {loading && (
              <div className="flex min-h-[440px] flex-col items-center justify-center text-center p-6">
                <div className="relative flex items-center justify-center">
                  <div className="h-14 w-14 animate-spin rounded-full border-3 border-slate-200 border-t-red-700" />
                  <div className="absolute">
                    <CardioSenseLogo className="h-6 w-6" variant="plain" />
                  </div>
                </div>
                <h3 className="mt-5 text-base font-semibold text-slate-900">
                  Running ECG Intelligence Pipeline
                </h3>
                <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-500">
                  Running model, Grad-CAM and RAG analysis...
                </p>
                <div className="mt-6 w-48 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-red-700 h-full w-2/3 animate-pulse rounded-full" />
                </div>
              </div>
            )}

            {/* RESULTS VIEW */}
            {result && (
              <div className="space-y-6">
                {/* PREDICTION HEADER & CONFIDENCE */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        MODEL CLASSIFICATION
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${dynamicStyles.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${dynamicStyles.dot}`} />
                        {dynamicStyles.statusText}
                      </span>
                    </div>

                    <h2 className={`mt-1.5 text-3xl sm:text-4xl font-bold tracking-tight ${dynamicStyles.text}`}>
                      {predictionLabel}
                    </h2>
                  </div>

                  {/* CONFIDENCE ACCENT BOX */}
                  <div
                    className={`rounded-xl border px-4 py-3 text-right ${dynamicStyles.boxBg} ${dynamicStyles.boxBorder}`}
                  >
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      Confidence
                    </p>
                    <p className={`text-2xl sm:text-3xl font-bold ${dynamicStyles.confidenceValue}`}>
                      {result.confidence}%
                    </p>
                  </div>
                </div>

                {/* GRAD-CAM CARD */}
                {result.gradcam_image && (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Grad-CAM Explanation
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Areas highlighted by the model during classification.
                        </p>
                      </div>
                      <span className="rounded bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        Activation Heatmap
                      </span>
                    </div>

                    <div className="p-3 bg-slate-900/[0.02] flex items-center justify-center">
                      <img
                        src={result.gradcam_image}
                        alt="Grad-CAM visualization of the ECG"
                        className="w-full max-h-[380px] object-contain rounded-lg bg-white border border-slate-100"
                      />
                    </div>
                  </div>
                )}

                {/* EVIDENCE-GROUNDED RAG EXPLANATION */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
                    <svg className="h-4 w-4 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="font-semibold text-slate-900 text-sm">
                      Evidence-grounded explanation
                    </h3>
                  </div>

                  <div className="text-sm leading-relaxed text-slate-700">
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => (
                          <h4 className="text-base font-semibold text-slate-900 mt-4 mb-2 pb-1 border-b border-slate-200">
                            {children}
                          </h4>
                        ),
                        h2: ({ children }) => (
                          <h5 className="text-sm font-semibold text-slate-900 mt-3 mb-1.5">
                            {children}
                          </h5>
                        ),
                        h3: ({ children }) => (
                          <h6 className="text-sm font-medium text-slate-800 mt-2 mb-1">
                            {children}
                          </h6>
                        ),
                        p: ({ children }) => (
                          <p className="mb-2.5 leading-relaxed text-slate-700 last:mb-0">
                            {children}
                          </p>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc pl-5 space-y-1 mb-2.5 text-slate-700">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal pl-5 space-y-1.5 mb-2.5 text-slate-700 font-medium">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="pl-1 text-slate-700 leading-relaxed font-normal">
                            {children}
                          </li>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold text-slate-900">
                            {children}
                          </strong>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-red-300 pl-3.5 py-1 italic bg-red-50/40 rounded-r text-slate-700 my-2">
                            {children}
                          </blockquote>
                        ),
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-red-700 hover:text-red-800 underline underline-offset-2 transition-colors"
                          >
                            <span>{children}</span>
                            <svg className="h-3 w-3 inline shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ),
                      }}
                    >
                      {result.rag_explanation}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* RETRIEVED EVIDENCE SOURCES */}
                {result.rag_sources.length > 0 && (
                  <div className="mt-8">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Retrieved Evidence Sources
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Evidence source &mdash; verify independently
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        {result.rag_sources.length} sources retrieved
                      </span>
                    </div>

                    <div className="grid gap-3.5 sm:grid-cols-2">
                      {result.rag_sources.map((source, index) => {
                        const similarityDisplay =
                          typeof source.similarity === "number"
                            ? `${(source.similarity * 100).toFixed(2)}%`
                            : source.similarity;

                        return (
                          <div
                            key={`${source.topic}-${source.similarity}-${index}`}
                            className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs transition-all hover:border-red-200 hover:shadow-sm flex flex-col justify-between"
                          >
                            <div>
                              {/* Source Icon + Topic + Similarity */}
                              <div className="flex items-start justify-between gap-2.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 border border-red-200 text-red-700">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-slate-900 text-sm leading-snug">
                                      {source.topic}
                                    </h4>
                                    {source.class && (
                                      <span className="text-[11px] font-medium text-slate-500">
                                        Target: {formatPrediction(source.class)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <span className="shrink-0 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 font-mono">
                                  Similarity: {similarityDisplay}
                                </span>
                              </div>

                              {/* Citation details & Title */}
                              <div className="mt-3 pt-3 border-t border-slate-100">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {source.source_name && (
                                    <span className="text-xs font-bold text-slate-900">
                                      {source.source_name}
                                    </span>
                                  )}
                                  {source.publication_year && (
                                    <span className="text-xs text-slate-400 font-medium">
                                      ({source.publication_year})
                                    </span>
                                  )}
                                  {source.source_type && (
                                    <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                      {source.source_type}
                                    </span>
                                  )}
                                </div>

                                {source.source_organization && (
                                  <p className="mt-1 text-xs text-slate-500 leading-snug">
                                    {source.source_organization}
                                  </p>
                                )}

                                {source.source_title && (
                                  <p className="mt-2 text-xs font-medium text-slate-700 leading-relaxed italic">
                                    &ldquo;{source.source_title}&rdquo;
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Clickable Official Reference */}
                            {source.source_url && (
                              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                                <a
                                  href={source.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800 transition-colors group"
                                >
                                  <span>View official reference</span>
                                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                                </a>
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                                  Primary Reference
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* MEDICAL DISCLAIMER */}
        <footer className="mt-10 rounded-xl border border-amber-300/60 bg-amber-50/60 p-4 sm:p-5 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-xs leading-relaxed text-slate-700">
              <span className="font-semibold text-slate-900 mr-1">Medical Research Disclaimer:</span>
              CardioSense is a research and decision-support prototype.
              Its prediction is a machine-learning classification based on
              an ECG image and should not be considered a medical diagnosis.
              Clinical decisions should be made by a qualified healthcare
              professional.
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
