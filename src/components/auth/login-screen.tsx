"use client";

import { useState, type FormEvent } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

/**
 * The only unauthenticated surface in the app. No signup link, no social
 * buttons, no password reset — this account is created by hand in the
 * Firebase console and there is exactly one of it.
 */
export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch {
      // Deliberately one vague message — never reveal whether the address
      // exists. It is a single-account app; there is nothing to enumerate.
      setError("Incorrect email or password.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 pt-safe">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-surface">
            <LockKeyhole className="h-6 w-6 text-blue" strokeWidth={1.75} />
          </div>
          <h1 className="text-[28px] font-[650] tracking-tight text-foreground">
            Weight Tracker
          </h1>
          <p className="mt-1.5 text-sm text-muted">144 to 149</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-5">
          <label className="label-metric mb-2 block" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input mb-4 h-12 w-full px-3.5 text-[15px]"
            placeholder="you@example.com"
          />

          <label className="label-metric mb-2 block" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input mb-1 h-12 w-full px-3.5 text-[15px]"
            placeholder="••••••••"
          />

          <p
            role="alert"
            aria-live="polite"
            className={`mt-3 min-h-5 text-[13px] ${
              error ? "text-danger" : "text-transparent"
            }`}
          >
            {error ?? "placeholder"}
          </p>

          <button
            type="submit"
            disabled={busy}
            className="btn-primary pressable mt-2 flex h-12 w-full items-center justify-center gap-2 text-[15px] font-[600] disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-[12px] text-muted">
          Stays signed in on this device.
        </p>
      </div>
    </main>
  );
}
