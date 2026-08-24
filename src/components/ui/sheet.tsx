"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Scroll lock, counted rather than saved and restored.
 *
 * Two sheets overlap whenever the food picker hands off to the quantity
 * sheet. With each one snapshotting body.overflow on open and writing that
 * snapshot back on close, the second sheet captures "hidden" from the first
 * and restores it on the way out — leaving the page permanently unscrollable.
 * A counter cannot get into that state.
 */
let lockCount = 0;

function lockScroll(): () => void {
  if (lockCount === 0) document.body.style.overflow = "hidden";
  lockCount++;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) document.body.style.overflow = "";
  };
}

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
    const unlock = lockScroll();

    return () => {
      window.removeEventListener("keydown", onKey);
      unlock();
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
        {/*
          Dismissal needs an explicit control. A full-height sheet leaves only
          a sliver of backdrop, and on a phone that sliver sits under the
          status bar — so tapping "outside" is not actually reachable.
        */}
        <div className="relative flex shrink-0 items-center justify-center pb-1 pt-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-16 items-center justify-center"
          >
            <span className="h-1 w-9 rounded-full bg-white/20" />
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            tabIndex={open ? 0 : -1}
            className="pressable absolute right-2 top-1 flex h-11 w-11 items-center justify-center rounded-full text-muted"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
