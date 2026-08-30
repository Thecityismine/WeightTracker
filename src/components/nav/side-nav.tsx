"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Home,
  Plus,
  Settings,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import { useFoodPicker } from "@/lib/food-picker-context";
import type { MealCategory } from "@/lib/constants";

/**
 * Desktop navigation.
 *
 * A bottom bar is a thumb-reach pattern; on a screen the size of an iPad it
 * strands the controls at the far edge and wastes the width. This rail takes
 * over at `lg`, after portrait iPads have used the full canvas for content.
 *
 * Foods gets a real entry here. On mobile it has no nav slot because the
 * elevated + occupies that position, but with a full rail there is room.
 */
const ITEMS = [
  { href: "/", label: "Today", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/foods", label: "Foods", icon: UtensilsCrossed },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function SideNav() {
  const pathname = usePathname();
  const { openPicker } = useFoodPicker();

  // Top padding is its own breathing room PLUS the notch inset. `pt-safe`
  // alone would replace the padding rather than add to it, leaving the header
  // flush against the top edge on any device that reports no inset.
  return (
    <nav
      className="fixed inset-y-0 left-0 z-40 hidden w-[236px] flex-col border-r border-white/[0.06] px-4 pb-6 lg:flex"
      style={{
        background: "rgba(9, 12, 16, 0.72)",
        backdropFilter: "blur(20px)",
        paddingTop: "calc(24px + env(safe-area-inset-top, 0px))",
      }}
    >
      <div className="px-2 pb-6">
        <p className="text-[15px] font-[650] tracking-tight text-foreground">
          Weight Tracker
        </p>
        <p className="mt-0.5 text-[12px] text-muted">144 to 149</p>
      </div>

      <button
        type="button"
        onClick={() => openPicker(mealForNow())}
        className="btn-primary pressable mb-5 flex h-11 w-full items-center justify-center gap-2 text-[14px] font-[600]"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        Add food
      </button>

      <ul className="flex flex-col gap-1">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="relative flex h-11 items-center gap-3 rounded-[12px] px-3 transition-colors"
                style={{
                  background: active ? "rgba(0,168,255,0.10)" : undefined,
                }}
              >
                {/* The blue indicator moves from under the icon to beside it. */}
                <span
                  className={`absolute left-0 h-5 w-[2px] rounded-full bg-blue transition-opacity ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
                <Icon
                  className={`h-[18px] w-[18px] ${
                    active ? "text-blue" : "text-muted"
                  }`}
                  strokeWidth={active ? 2 : 1.75}
                />
                <span
                  className={`text-[14px] ${
                    active
                      ? "font-[600] text-foreground"
                      : "font-[450] text-secondary"
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Same clock-based guess the mobile + button uses. */
function mealForNow(): MealCategory {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 17) return "snack";
  return "dinner";
}
