import React from "react";

interface CardioSenseLogoProps {
  className?: string;
  size?: number;
  variant?: "badge" | "plain";
}

export function CardioSenseLogo({
  className = "h-9 w-9",
  size,
  variant = "badge",
}: CardioSenseLogoProps) {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="CardioSense ECG Heart Logo"
    >
      {variant === "badge" && (
        <rect
          x="1.5"
          y="1.5"
          width="45"
          height="45"
          rx="12"
          fill="#FFF5F5"
          stroke="#FEE2E2"
          strokeWidth="1.5"
        />
      )}

      {/* Heart Outline */}
      <path
        d="M24 14.2C22.6 11 19.3 8.75 15.5 8.75C10.25 8.75 6 13 6 18.5C6 25.1 12 31.6 24 39.25C36 31.6 42 25.1 42 18.5C42 13 37.75 8.75 32.5 8.75C28.7 8.75 25.4 11 24 14.2Z"
        fill="#FEF2F2"
        fillOpacity="0.4"
        stroke="#DC2626"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Integrated ECG Waveform (Isoelectric baseline -> P -> Q -> R -> S -> T -> baseline) */}
      <path
        d="M8.5 24H14.5L16.2 21.2L18.2 27L21.2 13.8L24.8 34.2L27.8 21.8L30.2 26.5L32.2 24H39.5"
        stroke="#991B1B"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Conduction peak pulse node */}
      <circle cx="21.2" cy="13.8" r="1.6" fill="#DC2626" />
    </svg>
  );
}

export default CardioSenseLogo;
