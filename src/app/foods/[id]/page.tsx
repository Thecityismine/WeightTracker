"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Copy, Loader2, Trash2 } from "lucide-react";
import { FoodForm, toInput } from "@/components/foods/food-form";
import { VerificationBadge } from "@/components/foods/verification-badge";
import { useAuth } from "@/lib/auth-context";
import { useFoods } from "@/lib/hooks/use-foods";
import { createFood, deleteOrArchiveFood } from "@/lib/repo/foods";

export default function EditFoodPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { foods, loading } = useFoods(user?.uid ?? null);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const food = foods.find((f) => f.id === id) ?? null;

  async function handleDuplicate() {
    if (!user || !food) return;
    setBusy(true);
    try {
      const newId = await createFood(user.uid, {
        ...toInput(food),
        name: `${food.name} (copy)`,
        isFavorite: false,
      });
      router.push(`/foods/${newId}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!food) return;
    setBusy(true);
    try {
      const result = await deleteOrArchiveFood(food.id);
      if (result === "archived") {
        setNotice(
          "This food has been logged before, so it was archived rather than deleted. Your history keeps its original numbers.",
        );
        setTimeout(() => router.push("/foods"), 2200);
      } else {
        router.push("/foods");
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-lg">
        <p className="px-5 pt-10 text-[13px] text-muted">Loading…</p>
      </main>
    );
  }

  if (!food) {
    return (
      <main className="mx-auto max-w-lg px-5 pt-10">
        <p className="text-[15px] text-foreground">Food not found.</p>
        <p className="mt-1 text-[13px] text-muted">
          It may have been archived or deleted.
        </p>
        <Link
          href="/foods"
          className="btn-secondary pressable mt-4 flex h-11 w-full items-center justify-center text-[14px] font-[600]"
        >
          Back to Foods
        </Link>
      </main>
    );
  }

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
        <h1 className="px-1 text-[26px] font-[650] leading-tight tracking-tight text-foreground">
          {food.name}
        </h1>
        <div className="mt-1.5 px-1">
          <VerificationBadge status={food.verificationStatus} />
        </div>
      </header>

      <FoodForm initial={toInput(food)} foodId={food.id} />

      <div className="space-y-2 px-4 pb-12">
        <button
          type="button"
          onClick={() => void handleDuplicate()}
          disabled={busy}
          className="btn-secondary pressable flex h-11 w-full items-center justify-center gap-2 text-[14px] font-[600] disabled:opacity-60"
        >
          <Copy className="h-4 w-4" />
          Duplicate
        </button>

        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={busy}
          className="btn-destructive pressable flex h-11 w-full items-center justify-center gap-2 text-[14px] font-[600] disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Delete food
        </button>

        {notice ? (
          <p className="pt-1 text-[12px] leading-relaxed text-secondary">
            {notice}
          </p>
        ) : null}
      </div>
    </main>
  );
}
