import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const backendUrl =
    process.env.NEXT_PUBLIC_API_URL || "https://cardiosense-backend.vercel.app";

  const authorization = request.headers.get("authorization");

  try {
    const formData = await request.formData();

    const response = await fetch(`${backendUrl}/predict`, {
      method: "POST",
      headers: authorization
        ? { Authorization: authorization }
        : {},
      body: formData,
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    return typeof data === "string"
      ? new NextResponse(data, {
          status: response.status,
          headers: { "Content-Type": contentType || "text/plain" },
        })
      : NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[CardioSense] Prediction proxy error:", error);

    return NextResponse.json(
      { detail: "Unable to connect to CardioSense backend." },
      { status: 502 }
    );
  }
}
