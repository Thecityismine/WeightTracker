import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/api-auth";
import { lookupFood } from "@/lib/ai/claude";

export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireOwner(req);
  if (auth instanceof NextResponse) return auth;

  let query = "";
  try {
    ({ query } = await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request body." }, { status: 400 });
  }

  if (typeof query !== "string" || query.trim().length < 3) {
    return NextResponse.json(
      { error: "Describe the food in a few words." },
      { status: 400 },
    );
  }

  try {
    const food = await lookupFood(query.trim().slice(0, 500));
    return NextResponse.json({ food });
  } catch (e) {
    console.error("ai/lookup failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lookup failed." },
      { status: 502 },
    );
  }
}
