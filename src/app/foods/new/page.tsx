"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { FoodForm, blankFood } from "@/components/foods/food-form";

export default function NewFoodPage() {
  return (
    <main className="mx-auto max-w-lg">
      <header className="px-4 pb-3 pt-8">
        <Link
          href="/foods"
          className="mb-2 flex items-center gap-1 text-[13px] text-muted"
        >
          <ChevronLeft className="h-4 w-4" />
          Foods
        </Link>
        <h1 className="px-1 text-[26px] font-[650] tracking-tight text-foreground">
          New food
        </h1>
      </header>

      <FoodForm initial={blankFood()} />
    </main>
  );
}
