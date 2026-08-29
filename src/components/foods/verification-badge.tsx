import type { VerificationStatus } from "@/types";

export const VERIFICATION: Record<
  VerificationStatus,
  { color: string; label: string; short: string }
> = {
  label_verified: {
    color: "var(--success)",
    label: "Nutrition label verified",
    short: "Label",
  },
  usda_verified: {
    color: "var(--blue)",
    label: "USDA verified",
    short: "USDA",
  },
  barcode_imported: {
    color: "var(--cyan)",
    label: "Barcode database import",
    short: "Barcode",
  },
  user_entered: {
    color: "var(--text-muted)",
    label: "User entered",
    short: "Manual",
  },
  ai_estimated: {
    color: "var(--warning)",
    label: "AI estimated",
    short: "AI",
  },
};

/** Source dot plus label, used on food rows and the detail screen. */
export function VerificationBadge({
  status,
  compact = false,
}: {
  status: VerificationStatus;
  compact?: boolean;
}) {
  const v = VERIFICATION[status] ?? VERIFICATION.user_entered;
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: v.color }}
      />
      <span className="text-[11px] text-muted">
        {compact ? v.short : v.label}
      </span>
    </span>
  );
}

/**
 * The warning an AI-estimated food carries until it is confirmed.
 * DESIGN.md: amber information strip, never silently trusted.
 */
export function EstimateWarning() {
  return (
    <div
      className="mt-3 rounded-[12px] border px-3.5 py-2.5"
      style={{
        borderColor: "rgba(255,181,71,0.28)",
        background: "rgba(255,181,71,0.07)",
      }}
    >
      <p className="text-[12px] leading-relaxed" style={{ color: "var(--warning)" }}>
        Estimated nutrition. Confirm the serving size or replace it with label
        data when available.
      </p>
    </div>
  );
}
