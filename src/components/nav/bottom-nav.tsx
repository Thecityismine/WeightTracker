"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Plus, Settings, TrendingUp } from "lucide-react";
import { useFoodPicker } from "@/lib/food-picker-context";
import type { MealCategory } from "@/lib/constants";

const items = [
  { href: "/", label: "Today", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  // Left pair, then the elevated add button, then the right pair.
  const left = items.slice(0, 2);
  const right = items.slice(2);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] pb-safe md:hidden"
      style={{
        background: "rgba(9, 12, 16, 0.86)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div className="mx-auto flex h-[68px] max-w-lg items-center justify-around px-2">
        {left.map((item) => (
          <NavItem key={item.href} {...item} pathname={pathname} />
        ))}

        <AddButton />

        {right.map((item) => (
          <NavItem key={item.href} {...item} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  pathname,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  pathname: string;
}) {
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="relative flex h-full w-16 flex-col items-center justify-center gap-1"
    >
      {/* Small indicator line above the active item. */}
      <span
        className={`absolute top-0 h-[2px] w-8 rounded-full transition-opacity duration-200 ${
          active ? "bg-blue opacity-100" : "opacity-0"
        }`}
      />
      <Icon
        className={`h-[22px] w-[22px] transition-colors ${
          active ? "text-blue" : "text-muted"
        }`}
        strokeWidth={active ? 2 : 1.75}
      />
      <span
        className={`text-[11px] font-[550] transition-colors ${
          active ? "text-foreground" : "text-muted"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}

/** Elevated 52px center button — opens quick food selection. */
function AddButton() {
  const { openPicker } = useFoodPicker();

  return (
    <button
      type="button"
      aria-label="Add food"
      onClick={() => openPicker(mealForNow())}
      className="btn-primary pressable -mt-6 flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full"
    >
      <Plus className="h-6 w-6 text-white" strokeWidth={2.5} />
    </button>
  );
}

/**
 * Guess the meal from the clock so the quick-add lands in the right section
 * without asking. Still changeable inside the sheet.
 */
function mealForNow(): MealCategory {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 17) return "snack";
  return "dinner";
}
