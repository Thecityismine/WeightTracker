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

  // Initialising the Admin SDK is a SERVER concern and is resolved before the
  // token is examined. Folding both into one try meant a missing service
  // account surfaced as "Invalid token" — blaming the user's login for a
  // configuration problem they cannot see or fix from the client.
  let auth: ReturnType<typeof adminAuth>;
  try {
    auth = adminAuth();
  } catch (e) {
    console.error("Firebase Admin is not configured", e);
    return NextResponse.json(
      {
        error:
          "This feature needs the server's Firebase service-account key, which is not configured. See SETUP.md step 4.",
      },
      { status: 503 },
    );
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    if (decoded.uid !== allowedUid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return { uid: decoded.uid };
  } catch {
    return NextResponse.json(
      { error: "Your session has expired. Sign out and back in." },
      { status: 401 },
    );
  }
}
