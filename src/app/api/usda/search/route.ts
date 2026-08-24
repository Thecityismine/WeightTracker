import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/api-auth";
import { mapSearchHits } from "@/lib/usda";

const BASE = "https://api.nal.usda.gov/fdc/v1";

/**
 * Cache identical searches for the lifetime of the serverless instance.
 *
 * FoodData Central allows 1,000 requests an hour per key, and repeating the
 * same query while typing would burn through that for no new information.
 */
const cache = new Map<string, { at: number; body: unknown }>();
const TTL_MS = 10 * 60 * 1000;

export async function GET(req: Request) {
  const auth = await requireOwner(req);
  if (auth instanceof NextResponse) return auth;

  const query = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const key = process.env.USDA_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "USDA_API_KEY is not set. See SETUP.md step 6." },
      { status: 503 },
    );
  }

  const cached = cache.get(query);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json(cached.body);
  }

  try {
    const res = await fetch(`${BASE}/foods/search?api_key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        // Branded first: a packaged product's label beats any generic average.
        dataType: ["Branded", "Foundation", "SR Legacy"],
        pageSize: 25,
        requireAllWords: true,
      }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `USDA search failed (${res.status}).` },
        { status: 502 },
      );
    }

    const body = { results: mapSearchHits(await res.json()) };
    cache.set(query, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { error: "Could not reach the USDA database." },
      { status: 502 },
    );
  }
}
