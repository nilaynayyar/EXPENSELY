import { NextRequest, NextResponse } from "next/server";
import { analyzeReceiptImage, getActiveAIProvider } from "@/lib/receipt-ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, ocrText } = body;

    if (!image && !ocrText) {
      return NextResponse.json(
        { error: "Either image payload (base64) or OCR text is required for analysis." },
        { status: 400 }
      );
    }

    const result = await analyzeReceiptImage(image || "", ocrText || "");

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to analyze receipt";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  const active = getActiveAIProvider();
  return NextResponse.json({
    aiConfigured: active.provider !== null,
    provider: active.provider,
    model: active.model,
  });
}
