"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet — 24px top corners, 250ms rise, per DESIGN.md.
 *
 * Used full-height for food selection and compact for the quantity picker.
 */
export function Sheet({
  open,
  onClose,
  children,
  fullHeight = false,
  label,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  fullHeight?: boolean;
  label: string;
}) {
  // Escape closes, and the page behind must not scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/60 transition-opacity duration-250",
          open ? "opacity-100" : "opacity-0",
        )}
        style={{ backdropFilter: open ? "blur(2px)" : undefined }}
      />

      <div
        role="dialog"
        aria-modal={open}
        aria-label={label}
        className={cn(
          "absolute inset-x-0 bottom-0 mx-auto flex max-w-lg flex-col",
          "rounded-t-[24px] border-t border-white/10",
          "transition-transform duration-250 ease-out will-change-transform",
          fullHeight ? "h-[92dvh]" : "max-h-[85dvh]",
          open ? "translate-y-0" : "translate-y-full",
        )}
        style={{ background: "var(--background-secondary)" }}
      >
        {/* Grab handle — signals the sheet is dismissible. */}
        <div className="flex shrink-0 justify-center pb-1 pt-3">
          <div className="h-1 w-9 rounded-full bg-white/15" />
        </div>
        {children}
      </div>
    </div>
  );
}
