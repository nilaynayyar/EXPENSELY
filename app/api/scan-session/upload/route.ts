import { NextRequest, NextResponse } from "next/server";

interface ScanSession {
  id: string;
  createdAt: number;
  image: string | null;
  fileName: string | null;
  fileType: string | null;
}

const globalAny = global as any;
if (!globalAny.scanSessions) {
  globalAny.scanSessions = new Map<string, ScanSession>();
}
const sessions = globalAny.scanSessions as Map<string, ScanSession>;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const id = formData.get("id") as string;
    const file = formData.get("file") as File;

    if (!id) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "No file was uploaded" }, { status: 400 });
    }

    const session = sessions.get(id);
    if (!session) {
      return NextResponse.json({ error: "Session has expired or does not exist" }, { status: 404 });
    }

    // Read file bytes and convert to base64 data url
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64Data}`;

    session.image = dataUrl;
    session.fileName = file.name;
    session.fileType = file.type;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to upload file" }, { status: 500 });
  }
}
