import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Graphite surface, hairline border, 16px radius, inset top highlight.
 * Depth comes from the surface color, not from heavy shadows.
 */
export function Card({
  children,
  className,
  active = false,
}: {
  children: ReactNode;
  className?: string;
  active?: boolean;
}) {
  return (
    <div className={cn("card", active && "card-active", className)}>
      {children}
    </div>
  );
}

/** Muted uppercase section label — TODAY, BREAKFAST, WEIGHT PROGRESS. */
export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn("label-metric", className)}>{children}</p>;
}

/** Page heading used across the five screens. */
export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="px-5 pb-4 pt-8">
      <h1 className="text-[28px] font-[650] tracking-tight text-foreground">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-1 text-sm text-secondary">{subtitle}</p>
      ) : null}
    </header>
  );
}
