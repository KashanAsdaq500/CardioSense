import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "https://cardiosense-backend.vercel.app";
  const authorization = request.headers.get("authorization");

  const url = new URL(`${backendUrl}/history`);
  url.searchParams.set("limit", request.nextUrl.searchParams.get("limit") || "50");

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: authorization
        ? { Authorization: authorization }
        : {},
      cache: "no-store",
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("[CardioSense] History proxy error:", error);

    return NextResponse.json(
      { detail: "Unable to connect to CardioSense backend." },
      { status: 502 }
    );
  }
}
