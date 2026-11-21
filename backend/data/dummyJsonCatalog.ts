import { convertUsdToPhp, mapDummyJsonCategory } from "@/shared/retail";
import type { CatalogProduct, InventoryRecord } from "@/shared/types";

interface RawDummyProduct {
  id: number;
  sku?: string;
  title: string;
  brand?: string | null;
  category: string;
  price: number;
  discountPercentage?: number;
  rating?: number;
  stock?: number;
  description?: string;
  thumbnail: string;
  images?: string[];
}

export const FLAGSHIP_SPECS: Array<{
  sku: string;
  externalId: number;
  manilaStock: number;
  cebuStock: number;
  warehouseStock: number;
  reorderPoint: number;
  lastUpdated: string;
}> = [
  {
    sku: "SKU-101",
    externalId: 100,
    manilaStock: 18,
    cebuStock: 12,
    warehouseStock: 24,
    reorderPoint: 15,
    lastUpdated: "2026-11-20T08:00:00.000Z",
  },
  {
    sku: "SKU-102",
    externalId: 7,
    manilaStock: 14,
    cebuStock: 9,
    warehouseStock: 19,
    reorderPoint: 12,
    lastUpdated: "2026-11-20T08:00:00.000Z",
  },
  {
    sku: "SKU-103",
    externalId: 2,
    manilaStock: 4,
    cebuStock: 2,
    warehouseStock: 3,
    reorderPoint: 15,
    lastUpdated: "2026-11-20T08:15:00.000Z",
  },
  {
    sku: "SKU-104",
    externalId: 99,
    manilaStock: 11,
    cebuStock: 8,
    warehouseStock: 15,
    reorderPoint: 12,
    lastUpdated: "2026-11-20T08:10:00.000Z",
  },
  {
    sku: "SKU-105",
    externalId: 47,
    manilaStock: 22,
    cebuStock: 16,
    warehouseStock: 28,
    reorderPoint: 15,
    lastUpdated: "2026-11-20T08:05:00.000Z",
  },
  {
    sku: "SKU-106",
    externalId: 88,
    manilaStock: 5,
    cebuStock: 4,
    warehouseStock: 5,
    reorderPoint: 15,
    lastUpdated: "2026-11-20T08:20:00.000Z",
  },
];

const FALLBACK_RAW_PRODUCTS: RawDummyProduct[] = [
  {
    id: 100,
    sku: "MOB-APP-APP-100",
    title: "Apple Airpods",
    brand: "Apple",
    category: "mobile-accessories",
    price: 129.99,
    discountPercentage: 15.54,
    rating: 4.15,
    stock: 67,
    description:
      "The Apple Airpods offer a seamless wireless audio experience. With easy pairing, high-quality sound, and Siri integration, they are perfect for on-the-go listening.",
    thumbnail:
      "https://cdn.dummyjson.com/product-images/mobile-accessories/apple-airpods/thumbnail.webp",
    images: [
      "https://cdn.dummyjson.com/product-images/mobile-accessories/apple-airpods/1.webp",
      "https://cdn.dummyjson.com/product-images/mobile-accessories/apple-airpods/2.webp",
      "https://cdn.dummyjson.com/product-images/mobile-accessories/apple-airpods/3.webp",
    ],
  },
  {
    id: 7,
    sku: "FRA-CHA-CHA-007",
    title: "Chanel Coco Noir Eau De",
    brand: "Chanel",
    category: "fragrances",
    price: 129.99,
    discountPercentage: 16.51,
    rating: 4.26,
    stock: 58,
    description:
      "Coco Noir by Chanel is an elegant and mysterious fragrance, featuring notes of grapefruit, rose, and sandalwood. Perfect for evening occasions.",
    thumbnail:
      "https://cdn.dummyjson.com/product-images/fragrances/chanel-coco-noir-eau-de/thumbnail.webp",
    images: [
      "https://cdn.dummyjson.com/product-images/fragrances/chanel-coco-noir-eau-de/1.webp",
      "https://cdn.dummyjson.com/product-images/fragrances/chanel-coco-noir-eau-de/2.webp",
      "https://cdn.dummyjson.com/product-images/fragrances/chanel-coco-noir-eau-de/3.webp",
    ],
  },
  {
    id: 2,
    sku: "BEA-GLA-EYE-002",
    title: "Eyeshadow Palette with Mirror",
    brand: "Glamour Beauty",
    category: "beauty",
    price: 19.99,
    discountPercentage: 18.19,
    rating: 2.86,
    stock: 34,
    description:
      "The Eyeshadow Palette with Mirror offers a versatile range of eyeshadow shades for creating stunning eye looks. With a built-in mirror, it's convenient for on-the-go makeup application.",
    thumbnail:
      "https://cdn.dummyjson.com/product-images/beauty/eyeshadow-palette-with-mirror/thumbnail.webp",
    images: [
      "https://cdn.dummyjson.com/product-images/beauty/eyeshadow-palette-with-mirror/1.webp",
    ],
  },
  {
    id: 99,
    sku: "MOB-AMA-AMA-099",
    title: "Amazon Echo Plus",
    brand: "Amazon",
    category: "mobile-accessories",
    price: 99.99,
    discountPercentage: 12.07,
    rating: 4.99,
    stock: 61,
    description:
      "The Amazon Echo Plus is a smart speaker with built-in Alexa voice control. It features premium sound quality and serves as a hub for controlling smart home devices.",
    thumbnail:
      "https://cdn.dummyjson.com/product-images/mobile-accessories/amazon-echo-plus/thumbnail.webp",
    images: [
      "https://cdn.dummyjson.com/product-images/mobile-accessories/amazon-echo-plus/1.webp",
      "https://cdn.dummyjson.com/product-images/mobile-accessories/amazon-echo-plus/2.webp",
    ],
  },
  {
    id: 47,
    sku: "HOM-BRD-TAB-047",
    title: "Table Lamp",
    brand: "Karto",
    category: "home-decoration",
    price: 49.99,
    discountPercentage: 7.09,
    rating: 3.55,
    stock: 9,
    description:
      "The Table Lamp is a functional and decorative lighting solution for your living space. With a modern design, it provides both ambient and task lighting, enhancing the atmosphere.",
    thumbnail:
      "https://cdn.dummyjson.com/product-images/home-decoration/table-lamp/thumbnail.webp",
    images: [
      "https://cdn.dummyjson.com/product-images/home-decoration/table-lamp/1.webp",
    ],
  },
  {
    id: 88,
    sku: "MEN-NIK-NIK-088",
    title: "Nike Air Jordan 1 Red And Black",
    brand: "Nike",
    category: "mens-shoes",
    price: 149.99,
    discountPercentage: 4.12,
    rating: 4.77,
    stock: 7,
    description:
      "The Nike Air Jordan 1 in Red and Black is an iconic basketball sneaker known for its stylish design and high-performance features, making it a favorite among sneaker enthusiasts and athletes.",
    thumbnail:
      "https://cdn.dummyjson.com/product-images/mens-shoes/nike-air-jordan-1-red-and-black/thumbnail.webp",
    images: [
      "https://cdn.dummyjson.com/product-images/mens-shoes/nike-air-jordan-1-red-and-black/1.webp",
      "https://cdn.dummyjson.com/product-images/mens-shoes/nike-air-jordan-1-red-and-black/2.webp",
      "https://cdn.dummyjson.com/product-images/mens-shoes/nike-air-jordan-1-red-and-black/3.webp",
      "https://cdn.dummyjson.com/product-images/mens-shoes/nike-air-jordan-1-red-and-black/4.webp",
    ],
  },
  {
    id: 1,
    sku: "BEA-ESS-ESS-001",
    title: "Essence Mascara Lash Princess",
    brand: "Essence",
    category: "beauty",
    price: 9.99,
    discountPercentage: 10.48,
    rating: 2.56,
    stock: 99,
    description:
      "The Essence Mascara Lash Princess is a popular mascara known for its volumizing and lengthening effects. Achieve dramatic lashes with this long-lasting and cruelty-free formula.",
    thumbnail:
      "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp",
    images: [
      "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/1.webp",
    ],
  },
  {
    id: 4,
    sku: "BEA-CHI-LIP-004",
    title: "Red Lipstick",
    brand: "Chic Cosmetics",
    category: "beauty",
    price: 12.99,
    discountPercentage: 12.16,
    rating: 4.36,
    stock: 91,
    description:
      "The Red Lipstick is a classic and bold choice for adding a pop of color to your lips. With a creamy and pigmented formula, it provides a vibrant and long-lasting finish.",
    thumbnail:
      "https://cdn.dummyjson.com/product-images/beauty/red-lipstick/thumbnail.webp",
    images: [
      "https://cdn.dummyjson.com/product-images/beauty/red-lipstick/1.webp",
    ],
  },
  {
    id: 6,
    sku: "FRA-CAL-CAL-006",
    title: "Calvin Klein CK One",
    brand: "Calvin Klein",
    category: "fragrances",
    price: 49.99,
    discountPercentage: 1.89,
    rating: 4.37,
    stock: 29,
    description:
      "CK One by Calvin Klein is a classic unisex fragrance, known for its fresh and clean scent. It's a versatile fragrance suitable for everyday wear.",
    thumbnail:
      "https://cdn.dummyjson.com/product-images/fragrances/calvin-klein-ck-one/thumbnail.webp",
    images: [
      "https://cdn.dummyjson.com/product-images/fragrances/calvin-klein-ck-one/1.webp",
    ],
  },
  {
    id: 8,
    sku: "FRA-DIO-DIO-008",
    title: "Dior J'adore",
    brand: "Dior",
    category: "fragrances",
    price: 89.99,
    discountPercentage: 14.72,
    rating: 3.8,
    stock: 98,
    description:
      "J'adore by Dior is a luxurious and floral fragrance, known for its blend of ylang-ylang, rose, and jasmine. It embodies femininity and sophistication.",
    thumbnail:
      "https://cdn.dummyjson.com/product-images/fragrances/dior-j'adore/thumbnail.webp",
    images: [
      "https://cdn.dummyjson.com/product-images/fragrances/dior-j'adore/1.webp",
    ],
  },
];

function normalizeCatalogProduct(raw: RawDummyProduct): CatalogProduct {
  const images = Array.isArray(raw.images) && raw.images.length
    ? raw.images.filter((url): url is string => typeof url === "string" && url.startsWith("https://"))
    : [raw.thumbnail];
  return {
    id: raw.id,
    sku: (raw.sku || `DJ-${String(raw.id).padStart(3, "0")}`).trim().toUpperCase(),
    title: raw.title.trim(),
    brand: raw.brand?.trim() || "Karto",
    rawCategory: raw.category,
    category: mapDummyJsonCategory(raw.category),
    priceUsd: raw.price,
    unitPricePhp: convertUsdToPhp(raw.price),
    discountPercentage: Number((raw.discountPercentage ?? 0).toFixed(2)),
    rating: Number((raw.rating ?? 4.0).toFixed(2)),
    stock: Math.max(1, Math.round(raw.stock ?? 30)),
    description: raw.description?.trim() || raw.title.trim(),
    thumbnail: raw.thumbnail,
    images,
  };
}

export const FALLBACK_CATALOG_PRODUCTS: CatalogProduct[] =
  FALLBACK_RAW_PRODUCTS.map(normalizeCatalogProduct);

const CACHE_TTL_MS = 10 * 60 * 1000;
let catalogCache:
  | {
      products: CatalogProduct[];
      source: "live" | "fallback";
      fetchedAt: string;
      expiresAt: number;
    }
  | undefined;

export async function fetchDummyJsonCatalog(): Promise<{
  products: CatalogProduct[];
  source: "live" | "fallback";
  fetchedAt: string;
}> {
  const nowMs = Date.now();
  if (catalogCache && catalogCache.expiresAt > nowMs) {
    return {
      products: catalogCache.products,
      source: catalogCache.source,
      fetchedAt: catalogCache.fetchedAt,
    };
  }

  try {
    const res = await fetch("https://dummyjson.com/products?limit=100", {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`DummyJSON HTTP ${res.status}`);
    const data = (await res.json()) as { products?: RawDummyProduct[] };
    if (!Array.isArray(data.products) || data.products.length === 0) {
      throw new Error("Empty DummyJSON product list");
    }
    const products = data.products
      .filter((p) => typeof p.id === "number" && typeof p.title === "string" && typeof p.thumbnail === "string")
      .map(normalizeCatalogProduct);
    const fetchedAt = new Date().toISOString();
    catalogCache = {
      products,
      source: "live",
      fetchedAt,
      expiresAt: nowMs + CACHE_TTL_MS,
    };
    return { products, source: "live", fetchedAt };
  } catch {
    const fetchedAt = new Date().toISOString();
    return {
      products: FALLBACK_CATALOG_PRODUCTS,
      source: "fallback",
      fetchedAt,
    };
  }
}

export async function buildLiveSeedInventory(): Promise<InventoryRecord[]> {
  const { products } = await fetchDummyJsonCatalog();
  const byId = new Map(products.map((p) => [p.id, p]));
  const fallbackById = new Map(FALLBACK_CATALOG_PRODUCTS.map((p) => [p.id, p]));

  return FLAGSHIP_SPECS.map((spec) => {
    const p = byId.get(spec.externalId) || fallbackById.get(spec.externalId)!;
    return {
      sku: spec.sku,
      productName: p.title,
      category: p.category,
      unitPrice: p.unitPricePhp,
      manilaStock: spec.manilaStock,
      cebuStock: spec.cebuStock,
      warehouseStock: spec.warehouseStock,
      reorderPoint: spec.reorderPoint,
      lastUpdated: spec.lastUpdated,
      externalId: p.id,
      externalSku: p.sku,
      brand: p.brand,
      rating: p.rating,
      discountPercentage: p.discountPercentage,
      description: p.description,
      thumbnail: p.thumbnail,
      images: p.images,
    };
  });
}
