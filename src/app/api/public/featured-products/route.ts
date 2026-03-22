import { NextResponse } from "next/server";
import { getCachedFeaturedProducts } from "@/lib/landing/featured-products";

export async function GET() {
  try {
    const items = await getCachedFeaturedProducts();
    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return NextResponse.json({ items: [] as unknown[] });
  }
}
