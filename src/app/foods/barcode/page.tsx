"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Barcode, Camera, ChevronLeft, Loader2, Search } from "lucide-react";
import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";
import { FoodForm } from "@/components/foods/food-form";
import { Card, SectionLabel } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import type { FoodInput } from "@/lib/schemas";

export default function BarcodePage() {
  const { getToken } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [food, setFood] = useState<FoodInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(
    async (rawCode: string) => {
      const normalized = rawCode.replace(/\D/g, "");
      if (!/^\d{8,14}$/.test(normalized)) {
        setError("Enter a valid 8–14 digit UPC or EAN barcode.");
        return;
      }
      setCode(normalized);
      setScanning(false);
      setLookingUp(true);
      setError(null);
      try {
        const token = await getToken();
        const response = await fetch(`/api/barcode/${normalized}`, {
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? "Barcode lookup failed.");
        setFood(body.food as FoodInput);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Barcode lookup failed.",
        );
      } finally {
        setLookingUp(false);
      }
    },
    [getToken],
  );

  useEffect(() => {
    if (!scanning || !videoRef.current) return;

    let active = true;
    let handled = false;
    const reader = new BrowserMultiFormatReader();
    void reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        videoRef.current,
        (result, _error, controls) => {
          if (!active || handled || !result) return;
          handled = true;
          controls.stop();
          void lookup(result.getText());
        },
      )
      .then((controls) => {
        if (!active) controls.stop();
        else controlsRef.current = controls;
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setScanning(false);
        setError(
          cause instanceof Error && cause.name === "NotAllowedError"
            ? "Camera access was denied. Allow camera access or enter the barcode below."
            : "Could not start the camera. Enter the barcode below instead.",
        );
      });

    return () => {
      active = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [scanning, lookup]);

  if (food) {
    return (
      <main className="mx-auto max-w-lg lg:max-w-2xl">
        <header className="px-4 pb-3 pt-8">
          <button
            type="button"
            onClick={() => setFood(null)}
            className="mb-2 flex items-center gap-1 text-[13px] text-muted"
          >
            <ChevronLeft className="h-4 w-4" />
            Scan another barcode
          </button>
          <h1 className="px-1 text-[26px] font-[650] tracking-tight text-foreground">
            Review imported food
          </h1>
          <p className="mt-1 px-1 text-[12px] leading-relaxed text-muted">
            Barcode data can be community-entered. Confirm the serving and macros before adding it.
          </p>
        </header>
        <FoodForm key={code} initial={food} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg lg:max-w-2xl">
      <header className="px-4 pb-3 pt-8">
        <Link href="/foods" className="mb-2 flex items-center gap-1 text-[13px] text-muted">
          <ChevronLeft className="h-4 w-4" /> Foods
        </Link>
        <h1 className="px-1 text-[26px] font-[650] tracking-tight text-foreground">
          Scan barcode
        </h1>
        <p className="mt-1 px-1 text-[13px] text-secondary">
          Import serving information and macros from a UPC or EAN.
        </p>
      </header>

      <div className="space-y-4 px-4 pb-10">
        <Card className="overflow-hidden">
          {scanning ? (
            <div className="relative aspect-[4/3] bg-black">
              <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-x-[12%] top-1/2 h-24 -translate-y-1/2 rounded-[14px] border-2 border-cyan shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
              <p className="absolute inset-x-0 bottom-4 text-center text-[12px] font-[600] text-white">
                Center the barcode inside the frame
              </p>
            </div>
          ) : (
            <div className="grid min-h-56 place-items-center px-6 py-8 text-center">
              <div>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-white/[0.04]">
                  <Barcode className="h-6 w-6 text-cyan" />
                </span>
                <p className="mt-3 text-[14px] font-[600] text-foreground">
                  Scan the package barcode
                </p>
                <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-muted">
                  Camera access is used only while this scanner is open.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setScanning(true);
                  }}
                  className="btn-primary pressable mt-4 inline-flex h-11 items-center justify-center gap-2 px-5 text-[14px] font-[600]"
                >
                  <Camera className="h-4 w-4" /> Open camera
                </button>
              </div>
            </div>
          )}
        </Card>

        {scanning ? (
          <button
            type="button"
            onClick={() => setScanning(false)}
            className="btn-secondary pressable h-11 w-full text-[14px] font-[600]"
          >
            Stop camera
          </button>
        ) : null}

        <Card className="px-5 py-4">
          <SectionLabel>Enter barcode manually</SectionLabel>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              onKeyDown={(event) => {
                if (event.key === "Enter") void lookup(code);
              }}
              placeholder="012345678905"
              aria-label="UPC or EAN barcode"
              className="input metric h-12 min-w-0 flex-1 px-3.5 text-[15px]"
            />
            <button
              type="button"
              disabled={lookingUp || !/^\d{8,14}$/.test(code)}
              onClick={() => void lookup(code)}
              className="btn-primary pressable flex h-12 w-12 shrink-0 items-center justify-center disabled:opacity-40"
              aria-label="Look up barcode"
            >
              {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
        </Card>

        {lookingUp ? (
          <p className="text-center text-[13px] text-secondary">Looking up nutrition…</p>
        ) : null}
        {error ? <p className="text-[13px] leading-relaxed text-danger">{error}</p> : null}
        <p className="px-2 text-center text-[11px] leading-relaxed text-muted">
          Product information is provided by Open Food Facts. Always compare imported values with the package label.
        </p>
      </div>
    </main>
  );
}
