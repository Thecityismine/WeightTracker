import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/api-auth";
import { scanScaleScreenshot } from "@/lib/ai/claude";

export const maxDuration = 60;

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type Allowed = (typeof ALLOWED)[number];

export async function POST(req: Request) {
  const auth = await requireOwner(req);
  if (auth instanceof NextResponse) return auth;

  let imageBase64 = "";
  let mediaType = "";
  try {
    ({ imageBase64, mediaType } = await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request body." }, { status: 400 });
  }

  if (!ALLOWED.includes(mediaType as Allowed)) {
    return NextResponse.json(
      { error: "Screenshot must be a JPEG, PNG, WebP or GIF." },
      { status: 400 },
    );
  }
  if (typeof imageBase64 !== "string" || imageBase64.length < 100) {
    return NextResponse.json({ error: "No image received." }, { status: 400 });
  }
  if (imageBase64.length > 4_000_000) {
    return NextResponse.json(
      { error: "That screenshot is too large." },
      { status: 413 },
    );
  }

  try {
    const reading = await scanScaleScreenshot(imageBase64, mediaType as Allowed);
    return NextResponse.json({ reading });
  } catch (e) {
    console.error("ai/scale-scan failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not read that screenshot." },
      { status: 502 },
    );
  }
}
