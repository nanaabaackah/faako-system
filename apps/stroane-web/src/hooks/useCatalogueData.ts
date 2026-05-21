import { useEffect, useMemo, useState } from "react";
import { productApi } from "../api/products";
import {
  categories as localCategories,
  products as localProducts,
  normalizeProducts,
  shouldUseLocalCatalogueFallback,
  type CatalogueCategory,
  type Product,
} from "../data/products";

interface CatalogueDataState {
  products: Product[];
  categories: CatalogueCategory[];
  loading: boolean;
  source: "api" | "local";
  notice: string | null;
}

export const useCatalogueData = (): CatalogueDataState => {
  const [products, setProducts] = useState<Product[]>(localProducts);
  const [categories, setCategories] = useState<CatalogueCategory[]>(localCategories);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"api" | "local">("local");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadCatalogue = async () => {
      try {
        setLoading(true);
        const [apiProducts, apiCategories] = await Promise.all([
          productApi.getAll(),
          productApi.getCategories(),
        ]);

        if (cancelled) return;

        if (shouldUseLocalCatalogueFallback(apiProducts)) {
          setProducts(localProducts);
          setCategories(localCategories);
          setSource("local");
          setNotice("Showing the local catalogue because the backend catalogue is out of date.");
          return;
        }

        setProducts(apiProducts.length ? normalizeProducts(apiProducts) : localProducts);
        setCategories(apiCategories.length ? apiCategories : localCategories);
        setSource(apiProducts.length ? "api" : "local");
        setNotice(null);
      } catch (error) {
        if (cancelled) return;

        setProducts(localProducts);
        setCategories(localCategories);
        setSource("local");
        setNotice(
          error instanceof Error
            ? `Showing the local catalogue while the backend is unavailable: ${error.message}`
            : "Showing the local catalogue while the backend is unavailable."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadCatalogue();

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => ({ products, categories, loading, source, notice }),
    [categories, loading, notice, products, source]
  );
};

export default useCatalogueData;
