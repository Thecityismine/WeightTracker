import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/api-auth";
import { coachSummary, type CoachInput } from "@/lib/ai/claude";

export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireOwner(req);
  if (auth instanceof NextResponse) return auth;

  let body: CoachInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request body." }, { status: 400 });
  }

  if (!body?.weeks?.length) {
    return NextResponse.json(
      { error: "Not enough logged history to summarize yet." },
      { status: 400 },
    );
  }

  try {
    // Cap the history so a long-running log cannot balloon the prompt.
    const reply = await coachSummary({ ...body, weeks: body.weeks.slice(-8) });
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("ai/coach failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not build a summary." },
      { status: 502 },
    );
  }
}
