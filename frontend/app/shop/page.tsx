import type { Metadata } from "next";
import { ShopStorefront } from "@/frontend/components/ShopStorefront";

export const metadata: Metadata = {
  title: "Karto Shop | Online Storefront",
  description:
    "Customer-facing online storefront connected live to Karto inventory, 3PL logistics, GDPR personalized offers, and PCI DSS checkout.",
};

export default function ShopPage() {
  return <ShopStorefront />;
}
