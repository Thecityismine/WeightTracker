import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/api-auth";
import {
  mapOpenFoodFactsProduct,
  type OpenFoodFactsResponse,
} from "@/lib/open-food-facts";

const BASE = "https://world.openfoodfacts.org/api/v2/product";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const auth = await requireOwner(request);
  if (auth instanceof NextResponse) return auth;

  const { code } = await params;
  if (!/^\d{8,14}$/.test(code)) {
    return NextResponse.json(
      { error: "Enter a valid 8–14 digit UPC or EAN barcode." },
      { status: 400 },
    );
  }

  try {
    const fields = [
      "code",
      "product_name",
      "generic_name",
      "brands",
      "serving_size",
      "serving_quantity",
      "nutriments",
    ].join(",");
    const response = await fetch(
      `${BASE}/${code}.json?fields=${encodeURIComponent(fields)}`,
      {
        headers: {
          "User-Agent": "WeightTracker/1.0 (private nutrition tracker)",
        },
        next: { revalidate: 86_400 },
      },
    );
    if (!response.ok) {
      return NextResponse.json(
        { error: `Barcode database lookup failed (${response.status}).` },
        { status: 502 },
      );
    }

    const food = mapOpenFoodFactsProduct(
      (await response.json()) as OpenFoodFactsResponse,
      code,
    );
    if (!food) {
      return NextResponse.json(
        {
          error:
            "That barcode was not found with usable serving calories. You can still add it manually or scan its nutrition label.",
        },
        { status: 404 },
      );
    }
    return NextResponse.json({ food });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the barcode database." },
      { status: 502 },
    );
  }
}
