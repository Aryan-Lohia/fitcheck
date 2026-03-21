export type RawProductData = {
  title?: string;
  brand?: string;
  category?: string;
  genderTarget?: string;
  images: string[];
  sizes: string[];
  colors: string[];
  measurements: Record<string, number>;
  material?: string;
  fitType?: string;
  /** Display string (may include MRP/discount context) */
  price?: string;
  /** Stripped numeric or display MRP when distinct from selling price */
  mrp?: string;
  currency?: string;
  rating?: string;
  reviewCount?: string;
  sizeChartHtml?: string;
};

export function emptyRawProduct(): RawProductData {
  return {
    images: [],
    sizes: [],
    colors: [],
    measurements: {},
  };
}
