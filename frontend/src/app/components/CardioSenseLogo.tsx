import React from "react";
import Image from "next/image";

interface CardioSenseLogoProps {
  className?: string;
  size?: number;
  variant?: "badge" | "plain";
}

export function CardioSenseLogo({
  className = "h-10 w-10",
  size,
  variant = "badge",
}: CardioSenseLogoProps) {
  const pixelSize = size || 40;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${
        variant === "badge"
          ? "rounded-xl bg-gradient-to-b from-white to-red-50/60 p-1 border border-red-100/80 shadow-xs"
          : ""
      } ${className}`}
      style={size ? { width: size, height: size } : undefined}
    >
      <Image
        src="/cardiosense_logo.webp"
        alt="CardioSense 3D Heart Logo"
        width={pixelSize}
        height={pixelSize}
        priority
        className="w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(220,38,38,0.18)]"
      />
    </div>
  );
}

export default CardioSenseLogo;
