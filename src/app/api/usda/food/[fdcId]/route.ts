import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/api-auth";
import { mapDetail } from "@/lib/usda";

const BASE = "https://api.nal.usda.gov/fdc/v1";

const cache = new Map<string, { at: number; body: unknown }>();
const TTL_MS = 60 * 60 * 1000;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ fdcId: string }> },
) {
  const auth = await requireOwner(req);
  if (auth instanceof NextResponse) return auth;

  const { fdcId } = await ctx.params;
  if (!/^\d+$/.test(fdcId)) {
    return NextResponse.json({ error: "Bad food id." }, { status: 400 });
  }

  const key = process.env.USDA_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "USDA_API_KEY is not set. See SETUP.md step 6." },
      { status: 503 },
    );
  }

  const cached = cache.get(fdcId);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json(cached.body);
  }

  try {
    const res = await fetch(`${BASE}/food/${fdcId}?api_key=${key}`);
    if (!res.ok) {
      return NextResponse.json(
        { error: `USDA lookup failed (${res.status}).` },
        { status: 502 },
      );
    }

    const body = { food: mapDetail(await res.json()) };
    cache.set(fdcId, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { error: "Could not reach the USDA database." },
      { status: 502 },
    );
  }
}
