import "server-only";

import { NextResponse } from "next/server";
import { adminAuth } from "./firebase-admin";

export type AuthedContext = { uid: string };

/**
 * Guard for every /api/* route. Verifies the caller's Firebase ID token and
 * confirms it is the one allowed account before any billable work happens.
 *
 * Usage:
 *   const auth = await requireOwner(req);
 *   if (auth instanceof NextResponse) return auth;
 *   // auth.uid is trustworthy from here
 */
export async function requireOwner(
  req: Request,
): Promise<AuthedContext | NextResponse> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const allowedUid = process.env.ALLOWED_UID;
  if (!allowedUid) {
    // Fail closed. An unset allowlist must never mean "allow everyone".
    console.error("ALLOWED_UID is not set — refusing all API requests.");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  try {
    const decoded = await adminAuth().verifyIdToken(token);
    if (decoded.uid !== allowedUid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return { uid: decoded.uid };
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
