"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { useAuth, UserButton } from "@clerk/nextjs";
import { CardioSenseLogo } from "../components/CardioSenseLogo";

type HistoryItem = {
  id: string | number;
  filename: string;
  prediction: string;
  confidence: number;
  gradcam_image: string | null;
  rag_explanation: string | null;
  created_at: string;
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

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

function getStatusStyles(prediction: string) {
  const isNormal = prediction.toLowerCase() === "normal";
  return isNormal
    ? {
        text: "text-emerald-700",
        badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
        dot: "bg-emerald-600",
        boxBg: "bg-emerald-50/70",
        boxBorder: "border-emerald-200",
        statusText: "Normal Rhythm Pattern",
      }
    : {
        text: "text-red-700",
        badge: "bg-red-50 text-red-800 border-red-200",
        dot: "bg-red-600",
        boxBg: "bg-red-50/70",
        boxBorder: "border-red-200",
        statusText: "Abnormality Detected",
      };
}

export default function HistoryPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [analyses, setAnalyses] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(new Set());
  const [modalImage, setModalImage] = useState<{ src: string; title: string } | null>(null);

  const fetchHistory = async () => { console.log("[CardioSense] fetchHistory called"); console.log("[CardioSense] isLoaded:", isLoaded, "isSignedIn:", isSignedIn);
    setLoading(true);
    setError("");

    try {
      const token = await getToken(); console.log("[CardioSense] token exists:", !!token);
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/backend/history?limit=50`, {
        headers,
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Session expired or authentication required. Please sign in again.");
        }
        throw new Error(`Failed to load history (HTTP ${response.status})`);
      }

      const data: HistoryItem[] = await response.json();
      setAnalyses(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load previous ECG analyses."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded) {
      fetchHistory();
    }
  }, [isLoaded]);

  const toggleExpand = (id: string | number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-xs sticky top-0 z-30 shadow-xs">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <CardioSenseLogo className="h-10 w-10 shrink-0" variant="badge" />
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-base font-bold tracking-[0.16em] text-slate-900 leading-none group-hover:text-red-700 transition-colors">
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
          </Link>

          {/* NAVIGATION */}
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <Link
                href="/"
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white/80 transition-all"
              >
                Analyze
              </Link>
              <Link
                href="/history"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-white text-red-700 shadow-xs border border-slate-200/60 transition-all"
              >
                History
              </Link>
            </nav>

            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Database Synced
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

      {/* MAIN CONTENT */}
      <main className="flex-1 mx-auto max-w-6xl w-full px-4 sm:px-6 py-8 sm:py-10">
        {/* PAGE HEADER */}
        <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-semibold uppercase tracking-wider mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
              Records Archive
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Analysis History
            </h1>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl">
              Previous ECG analyses saved in the CardioSense platform are displayed here with model classifications, confidence ratings, Grad-CAM attention maps, and clinical explanations.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <svg
                className={`h-3.5 w-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Refresh</span>
            </button>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-800 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Analysis</span>
            </Link>
          </div>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-red-700 mb-4" />
            <h3 className="text-base font-semibold text-slate-800">
              Loading Analysis History...
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Retrieving saved records and Grad-CAM visualizations from the database.
            </p>
          </div>
        )}

        {/* ERROR STATE */}
        {!loading && error && (
          <div className="my-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700 mb-3">
              <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="text-base font-bold text-red-900">
              Unable to Load Analysis Records
            </h3>
            <p className="mt-1 text-xs text-red-700 max-w-md mx-auto">{error}</p>
            <button
              onClick={fetchHistory}
              className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-800 transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && !error && analyses.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-slate-300 bg-white p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 border border-slate-200 shadow-xs mb-4 text-slate-400">
              <CardioSenseLogo className="h-10 w-10" variant="plain" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">
              No Previous Analyses Found
            </h3>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">
              When you upload and analyze electrocardiograms, they will be archived here with diagnostic classification, Grad-CAM overlays, and evidence summaries.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-red-700 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-red-800 transition-colors"
            >
              Start First ECG Analysis →
            </Link>
          </div>
        )}

        {/* LIST / CARDS OF ANALYSES */}
        {!loading && !error && analyses.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-mono">
              <span>{analyses.length} total records</span>
              <span>Sorted by newest first</span>
            </div>

            {analyses.map((item) => {
              const styles = getStatusStyles(item.prediction);
              const isExpanded = expandedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* LEFT COLUMN: FILENAME, METADATA, PREDICTION */}
                    <div className="flex items-start gap-4">
                      {/* GRAD-CAM THUMBNAIL */}
                      {item.gradcam_image ? (
                        <div
                          onClick={() =>
                            setModalImage({
                              src: item.gradcam_image!,
                              title: `Grad-CAM — ${formatPrediction(item.prediction)} (${item.filename})`,
                            })
                          }
                          className="group relative h-20 w-24 sm:h-22 sm:w-28 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-xs hover:ring-2 hover:ring-red-400 transition-all"
                          title="Click to expand Grad-CAM"
                        >
                          <img
                            src={item.gradcam_image}
                            alt="Grad-CAM thumbnail"
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-xs">
                              Enlarge
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-20 w-24 sm:h-22 sm:w-28 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                          <span className="text-[10px] font-mono">No CAM</span>
                        </div>
                      )}

                      {/* DETAILS */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles.badge}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                            {styles.statusText}
                          </span>

                          <span className="text-xs text-slate-400 font-mono">
                            ID: #{item.id}
                          </span>
                        </div>

                        <h3 className={`text-xl sm:text-2xl font-bold tracking-tight ${styles.text}`}>
                          {formatPrediction(item.prediction)}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="font-medium text-slate-700 flex items-center gap-1">
                            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {item.filename}
                          </span>

                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatDate(item.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: CONFIDENCE & DETAILS BUTTON */}
                    <div className="flex sm:flex-row lg:flex-col items-end sm:items-center lg:items-end justify-between sm:justify-end gap-3 pt-3 lg:pt-0 border-t border-slate-100 lg:border-t-0">
                      {/* CONFIDENCE BOX */}
                      <div className={`rounded-xl border px-3.5 py-2 text-right ${styles.boxBg} ${styles.boxBorder}`}>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                          Confidence
                        </p>
                        <p className={`text-lg sm:text-xl font-bold ${styles.text}`}>
                          {item.confidence}%
                        </p>
                      </div>

                      {/* VIEW DETAILS / EXPAND BUTTON */}
                      {item.rag_explanation && (
                        <button
                          onClick={() => toggleExpand(item.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          <span>{isExpanded ? "Hide Details" : "View Details"}</span>
                          <svg
                            className={`h-3.5 w-3.5 text-slate-500 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* EXPANDABLE RAG EXPLANATION & SOURCES SECTION */}
                  {isExpanded && item.rag_explanation && (
                    <div className="mt-5 pt-5 border-t border-slate-100 space-y-4">
                      {/* GRAD-CAM DISPLAY IF AVAILABLE */}
                      {item.gradcam_image && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                Grad-CAM Activation Heatmap
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                Convolutional feature map corresponding to classification decision.
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                setModalImage({
                                  src: item.gradcam_image!,
                                  title: `Grad-CAM — ${formatPrediction(item.prediction)} (${item.filename})`,
                                })
                              }
                              className="text-xs text-red-700 hover:underline font-medium"
                            >
                              Enlarge view ↗
                            </button>
                          </div>
                          <div className="flex items-center justify-center bg-white rounded-lg p-2 border border-slate-200">
                            <img
                              src={item.gradcam_image}
                              alt="Full Grad-CAM"
                              className="max-h-72 w-full object-contain rounded"
                            />
                          </div>
                        </div>
                      )}

                      {/* SAVED RAG EXPLANATION */}
                      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
                          <svg className="h-4 w-4 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <h4 className="font-semibold text-slate-900 text-sm">
                            Saved Clinical Explanation
                          </h4>
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
                                <h6 className="text-sm font-semibold text-slate-800 mt-2 mb-1">
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
                            {item.rag_explanation}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* MEDICAL DISCLAIMER */}
        <footer className="mt-12 rounded-xl border border-amber-300/60 bg-amber-50/60 p-4 sm:p-5 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-xs leading-relaxed text-slate-700">
              <span className="font-semibold text-slate-900 mr-1">Medical Research Disclaimer:</span>
              CardioSense is a research and decision-support prototype. Its prediction is a machine-learning classification based on an ECG image and should not be considered a medical diagnosis. Clinical decisions should be made by a qualified healthcare professional.
            </div>
          </div>
        </footer>
      </main>

      {/* FULL-IMAGE MODAL */}
      {modalImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
          onClick={() => setModalImage(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900 text-sm">{modalImage.title}</h3>
              <button
                onClick={() => setModalImage(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="mt-4 flex items-center justify-center bg-slate-50 rounded-xl p-2 max-h-[75vh] overflow-auto">
              <img src={modalImage.src} alt={modalImage.title} className="max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



