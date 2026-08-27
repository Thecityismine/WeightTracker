"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera, ImagePlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Sheet } from "@/components/ui/sheet";
import { NumberField } from "@/components/ui/number-field";
import { SectionLabel } from "@/components/ui/card";
import { useProgressPhotos } from "@/lib/hooks/use-progress-photos";
import {
  deleteProgressPhoto,
  saveProgressPhoto,
} from "@/lib/repo/progress-photos";
import {
  deleteStoredImage,
  uploadProgressImage,
} from "@/lib/repo/storage";
import { formatWeight } from "@/lib/nutrition";
import { fromDateKey, todayKey } from "@/lib/dates";
import type { ProgressPhoto, WeightUnit } from "@/types";

export function ProgressPhotos({
  userId,
  suggestedWeight,
  unit,
}: {
  userId: string | null;
  suggestedWeight: number | null;
  unit: WeightUnit;
}) {
  const { photos, loading } = useProgressPhotos(userId);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ProgressPhoto | null>(null);
  const latest = photos.at(-1) ?? null;
  const previous = photos.at(-2) ?? null;

  function openEditor(photo: ProgressPhoto | null = null) {
    setEditing(photo);
    setEditorOpen(true);
  }

  return (
    <section className="mt-8 border-t border-white/[0.06] px-4 pb-28 pt-7 lg:px-0 lg:pb-12">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <SectionLabel>Monthly progress</SectionLabel>
          <p className="mt-1 text-[13px] text-secondary">
            Compare your two most recent check-ins.
          </p>
        </div>
        {latest ? (
          <button
            type="button"
            onClick={() => openEditor(null)}
            className="pressable flex h-9 items-center gap-1.5 rounded-full border border-white/10 px-3 text-[12px] font-[600] text-secondary"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Add photo
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="grid h-72 place-items-center rounded-[16px] border border-white/[0.06] text-[13px] text-muted">
          Loading photos…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:gap-5">
          <PhotoCard photo={previous} side="previous" unit={unit} onOpen={openEditor} />
          <PhotoCard photo={latest} side="latest" unit={unit} onOpen={openEditor} />
        </div>
      )}

      {previous && latest && previous.weight != null && latest.weight != null ? (
        <p className="metric mt-3 text-right text-[12px] text-muted">
          {signedWeight(latest.weight - previous.weight)} {unit} since {monthLabel(previous.monthKey)}
        </p>
      ) : null}

      <ProgressPhotoSheet
        key={`${editing?.id ?? "new"}-${editorOpen}`}
        open={editorOpen}
        userId={userId}
        photos={photos}
        existing={editing}
        suggestedWeight={suggestedWeight}
        unit={unit}
        onClose={() => setEditorOpen(false)}
      />
    </section>
  );
}

function PhotoCard({
  photo,
  side,
  unit,
  onOpen,
}: {
  photo: ProgressPhoto | null;
  side: "previous" | "latest";
  unit: WeightUnit;
  onOpen: (photo: ProgressPhoto | null) => void;
}) {
  if (!photo) {
    return (
      <button
        type="button"
        onClick={() => onOpen(null)}
        className="pressable flex min-w-0 flex-col text-left"
      >
        <span className="grid aspect-[3/4] w-full place-items-center rounded-[16px] border border-dashed border-white/15 bg-white/[0.025] px-3 text-center">
          <span>
            <Camera className="mx-auto h-5 w-5 text-muted" />
            <span className="mt-2 block text-[12px] font-[600] text-secondary">
              {side === "latest" ? "Add your first photo" : "Previous month"}
            </span>
          </span>
        </span>
        <span className="mt-2 text-[11px] text-muted">
          {side === "latest" ? "Start this month’s check-in" : "Your comparison will appear here"}
        </span>
      </button>
    );
  }

  return (
    <button type="button" onClick={() => onOpen(photo)} className="pressable min-w-0 text-left">
      <span className="relative block aspect-[3/4] overflow-hidden rounded-[16px] border border-white/10 bg-surface">
        <Image
          src={photo.imageUrl}
          alt={`${monthLabel(photo.monthKey)} progress photo`}
          fill
          sizes="(max-width: 1024px) 50vw, 480px"
          className="object-cover"
        />
        <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-sm">
          <Pencil className="h-3.5 w-3.5" />
        </span>
      </span>
      <span className="mt-2 block truncate text-[13px] font-[600] text-foreground">
        {monthLabel(photo.monthKey)}
      </span>
      <span className="metric mt-0.5 block text-[11px] text-muted">
        {format(fromDateKey(photo.photoDate), "MMM d")}
        {photo.weight == null ? " · No weight" : ` · ${formatWeight(photo.weight)} ${unit}`}
      </span>
    </button>
  );
}

function ProgressPhotoSheet({
  open,
  userId,
  photos,
  existing,
  suggestedWeight,
  unit,
  onClose,
}: {
  open: boolean;
  userId: string | null;
  photos: ProgressPhoto[];
  existing: ProgressPhoto | null;
  suggestedWeight: number | null;
  unit: WeightUnit;
  onClose: () => void;
}) {
  const [date, setDate] = useState(existing?.photoDate ?? todayKey());
  const [weight, setWeight] = useState<number | null>(existing?.weight ?? suggestedWeight);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  const preview = localPreview ?? existing?.imageUrl ?? null;

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  function handleFile(nextFile: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const nextPreview = nextFile ? URL.createObjectURL(nextFile) : null;
    previewRef.current = nextPreview;
    setFile(nextFile);
    setLocalPreview(nextPreview);
  }

  async function handleSave() {
    if (!userId || (!file && !existing)) return;
    setBusy(true);
    setError(null);
    let uploaded: { url: string; path: string } | null = null;
    try {
      const targetExisting =
        existing ?? photos.find((photo) => photo.monthKey === date.slice(0, 7)) ?? null;
      uploaded = file ? await uploadProgressImage(userId, file) : null;
      await saveProgressPhoto(
        userId,
        {
          photoDate: date,
          imageUrl: uploaded?.url ?? existing!.imageUrl,
          storagePath: uploaded?.path ?? existing!.storagePath,
          weight,
        },
        targetExisting,
      );
      if (uploaded && targetExisting?.storagePath) {
        await deleteStoredImage(targetExisting.storagePath);
      }
      onClose();
    } catch (cause) {
      if (uploaded) await deleteStoredImage(uploaded.path);
      setError(cause instanceof Error ? cause.message : "Could not save this photo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!existing || !window.confirm(`Delete the ${monthLabel(existing.monthKey)} progress photo?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteProgressPhoto(existing.monthKey);
      await deleteStoredImage(existing.storagePath);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} label={existing ? "Edit progress photo" : "Add progress photo"}>
      <div className="overflow-y-auto px-5 pb-7">
        <h2 className="text-xl font-[650] text-foreground">
          {existing ? `Edit ${monthLabel(existing.monthKey)}` : "Monthly progress photo"}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-secondary">
          One check-in is kept per month. Adding another for the same month replaces it.
        </p>

        <label className="relative mt-5 block aspect-[3/4] max-h-[42vh] w-full cursor-pointer overflow-hidden rounded-[16px] border border-dashed border-white/15 bg-surface">
          {preview ? (
            <Image src={preview} alt="Progress photo preview" fill unoptimized={Boolean(file)} className="object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-center">
              <span>
                <Camera className="mx-auto h-6 w-6 text-muted" />
                <span className="mt-2 block text-[13px] font-[600] text-secondary">Choose or take a photo</span>
              </span>
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          />
        </label>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <label className="text-[12px] text-muted">
            Photo date
            <input
              className="input mt-1 h-11 w-full px-3 text-[14px]"
              type="date"
              min={existing ? `${existing.monthKey}-01` : undefined}
              max={existing ? monthEnd(existing.monthKey) : todayKey()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="text-[12px] text-muted">
            Weight ({unit})
            <NumberField
              value={weight}
              onChange={setWeight}
              allowNull
              onNull={() => setWeight(null)}
              step="0.1"
              placeholder="Optional"
              className="input metric mt-1 h-11 w-full px-3 text-[14px]"
            />
          </label>
        </div>

        {error ? <p className="mt-3 text-[12px] text-danger">{error}</p> : null}

        <button
          type="button"
          disabled={busy || (!file && !existing) || !date}
          onClick={() => void handleSave()}
          className="btn-primary pressable mt-5 flex h-12 w-full items-center justify-center gap-2 text-[14px] font-[650] disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {busy ? "Saving…" : existing ? "Save changes" : "Save monthly photo"}
        </button>

        {existing ? (
          <button type="button" disabled={busy} onClick={() => void handleDelete()} className="pressable mt-3 flex h-11 w-full items-center justify-center gap-2 text-[13px] font-[600] text-danger disabled:opacity-40">
            <Trash2 className="h-4 w-4" /> Delete photo
          </button>
        ) : null}
      </div>
    </Sheet>
  );
}

function monthLabel(monthKey: string): string {
  return format(fromDateKey(`${monthKey}-01`), "MMMM yyyy");
}

function signedWeight(value: number): string {
  const rounded = formatWeight(Math.abs(value));
  if (value > 0) return `+${rounded}`;
  if (value < 0) return `−${rounded}`;
  return rounded;
}

function monthEnd(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${monthKey}-${String(lastDay).padStart(2, "0")}`;
}
