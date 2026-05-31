import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  HiOutlineEye,
  HiOutlinePencil,
  HiOutlinePhotograph,
  HiOutlineRefresh,
  HiOutlineSave,
  HiOutlineShoppingBag,
} from "react-icons/hi";
import {
  ERPActionBar,
  ERPDrawer,
  ERPForm,
  ERPFormActions,
  ERPFormNotice,
  ERPFormRow,
  ERPFormSection,
  ERPPrimaryAction,
  ERPSecondaryAction,
  ERPSelectField,
  ERPStatusBadge,
  ERPTable,
  ERPTableFilters,
  ERPTableSearch,
  ERPTextField,
  ERPTextareaField,
  type ERPTableColumn,
} from "@faako/ui";
import { adminInventoryApi, type SupplierSummary } from "../api/adminInventory";
import {
  adminProductsApi,
  type AdminProduct,
  type AdminProductCategory,
} from "../api/adminProducts";
import { useAdminPortal } from "../context/AdminPortalContext";
import useSEOMeta from "../hooks/useSEOMeta";
import { portalUrl } from "../config/appSurface";
import {
  PRODUCT_IMAGE_FALLBACK,
  normalizeProductImagePath,
  parseProductGalleryPaths,
} from "../utils/productMedia";
import "../styles/pages/AdminProducts.css";

type ProductDraft = {
  name: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  currency: string;
  categorySlug: string;
  tags: string;
  thumbnailImage: string;
  galleryImages: string;
  publishingStatus: "draft" | "active" | "archived";
  isFeatured: boolean;
  supplierId: string;
  supplierSku: string;
  supplierNotes: string;
};

const STATUS_OPTIONS = [
  { value: "", label: "All publishing states" },
  { value: "active", label: "Active / published" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived / inactive" },
];

const formatDateTime = (value?: string | null) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatMoney = (value?: number | null, currency = "GHS") =>
  value == null
    ? "Price unavailable"
    : new Intl.NumberFormat("en-GH", { style: "currency", currency }).format(value);

const formatStatus = (value = "") =>
  value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const getPublishingTone = (status: string) => {
  if (status === "active") return "success";
  if (status === "draft") return "warning";
  return "neutral";
};

const getStockTone = (product: AdminProduct) => {
  if (product.stock.isOutOfStock) return "danger";
  if (product.stock.isLowStock) return "warning";
  return "success";
};

const toDraft = (product: AdminProduct): ProductDraft => ({
  name: product.name,
  slug: product.slug,
  shortDescription: product.shortDescription || "",
  longDescription: product.longDescription || "",
  sku: product.sku || "",
  price: product.price == null ? "" : String(product.price),
  compareAtPrice: product.compareAtPrice == null ? "" : String(product.compareAtPrice),
  currency: product.currency || "GHS",
  categorySlug: product.categorySlug || "",
  tags: product.tags.join(", "),
  thumbnailImage: product.thumbnailImage || "",
  galleryImages: product.galleryImages.join("\n"),
  publishingStatus: product.publishingStatus,
  isFeatured: product.isFeatured,
  supplierId: product.preferredSupplier?.supplierId || "",
  supplierSku: product.preferredSupplier?.supplierSku || "",
  supplierNotes: product.preferredSupplier?.notes || "",
});

const ProductImagePreview: React.FC<{ path?: string | null; alt: string }> = ({ path, alt }) => {
  const [src, setSrc] = useState(path || PRODUCT_IMAGE_FALLBACK);
  useEffect(() => setSrc(path || PRODUCT_IMAGE_FALLBACK), [path]);
  return (
    <img
      src={src}
      alt={alt}
      onError={() => {
        if (src !== PRODUCT_IMAGE_FALLBACK) setSrc(PRODUCT_IMAGE_FALLBACK);
      }}
    />
  );
};

const getGalleryPreviewPaths = (value: string) => {
  try {
    return parseProductGalleryPaths(value);
  } catch {
    return [];
  }
};

const AdminProducts: React.FC = () => {
  const { session } = useAdminPortal();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminProductCategory[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(null);
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [search, setSearch] = useState("");
  const [publishingStatus, setPublishingStatus] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isAdmin = session?.role === "ADMIN";

  useSEOMeta({
    title: "Product operations | Stroane",
    description: "Private Stroane product and media operations.",
    canonical: portalUrl("/admin/products"),
    noIndex: true,
  });

  const loadProducts = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const [{ products: nextProducts, categories: nextCategories }, nextSuppliers] =
        await Promise.all([
          adminProductsApi.listProducts(session, {
            search,
            publishingStatus,
            categorySlug,
            tag,
            limit: 200,
          }),
          adminInventoryApi.listSuppliers(session),
        ]);
      setProducts(nextProducts);
      setCategories(nextCategories);
      setSuppliers(nextSuppliers);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load products.");
    } finally {
      setLoading(false);
    }
  }, [categorySlug, publishingStatus, search, session, tag]);

  useEffect(() => {
    const timeout = window.setTimeout(loadProducts, 180);
    return () => window.clearTimeout(timeout);
  }, [loadProducts]);

  const openProduct = async (productId: string) => {
    if (!session) return;
    setDetailLoading(true);
    setError("");
    try {
      const product = await adminProductsApi.getProduct(session, productId);
      setSelectedProduct(product);
      setDraft(toDraft(product));
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Unable to load product.");
    } finally {
      setDetailLoading(false);
    }
  };

  const updateDraft = <Key extends keyof ProductDraft>(key: Key, value: ProductDraft[Key]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const closeEditor = () => {
    setSelectedProduct(null);
    setDraft(null);
  };

  const submitProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session || !selectedProduct || !draft || !isAdmin) return;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const thumbnailImage = normalizeProductImagePath(draft.thumbnailImage);
      const galleryImages = parseProductGalleryPaths(draft.galleryImages);
      const tags = [...new Set(draft.tags.split(",").map((item) => item.trim()).filter(Boolean))];

      await adminProductsApi.updateProduct(session, selectedProduct.id, {
        name: draft.name,
        slug: draft.slug,
        shortDescription: draft.shortDescription,
        longDescription: draft.longDescription,
        sku: draft.sku,
        price: draft.price || null,
        compareAtPrice: draft.compareAtPrice || null,
        currency: draft.currency,
        categorySlug: draft.categorySlug || null,
        tags,
      });
      await adminProductsApi.updateMedia(session, selectedProduct.id, {
        thumbnailImage: thumbnailImage || null,
        galleryImages,
      });
      await adminProductsApi.updatePublishing(session, selectedProduct.id, {
        publishingStatus: draft.publishingStatus,
        isFeatured: draft.isFeatured,
      });
      await adminProductsApi.updateSupplier(session, selectedProduct.id, {
        supplierId: draft.supplierId || null,
        supplierSku: draft.supplierSku,
        notes: draft.supplierNotes,
      });

      const savedProduct = await adminProductsApi.getProduct(session, selectedProduct.id);
      setSelectedProduct(savedProduct);
      setDraft(toDraft(savedProduct));
      setProducts((current) =>
        current.map((product) => (product.id === savedProduct.id ? savedProduct : product))
      );
      setNotice(`${savedProduct.name} was updated.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update product.");
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(
    () => ({
      total: products.length,
      active: products.filter((product) => product.publishingStatus === "active").length,
      draft: products.filter((product) => product.publishingStatus === "draft").length,
      attention: products.filter((product) => product.stock.isLowStock || product.stock.isOutOfStock)
        .length,
    }),
    [products]
  );

  const columns = useMemo<Array<ERPTableColumn<AdminProduct>>>(
    () => [
      {
        id: "product",
        header: "Product",
        mobileLabel: "Product",
        render: (product) => (
          <span className="admin-products-table__product">
            <span className="admin-products-table__thumb">
              <ProductImagePreview path={product.thumbnailImage} alt="" />
            </span>
            <span>
              <strong>{product.name}</strong>
              <small>{product.sku || product.slug}</small>
            </span>
          </span>
        ),
      },
      {
        id: "category",
        header: "Category",
        mobileLabel: "Category",
        render: (product) => product.category?.name || "Uncategorized",
      },
      {
        id: "price",
        header: "Price",
        mobileLabel: "Price",
        render: (product) => formatMoney(product.price, product.currency),
      },
      {
        id: "stock",
        header: "Stock",
        mobileLabel: "Stock",
        render: (product) => (
          <span className="admin-products-table__stock">
            <ERPStatusBadge tone={getStockTone(product)}>
              {formatStatus(product.stock.stockStatus)}
            </ERPStatusBadge>
            <small>
              {product.stock.availableQuantity == null
                ? "Available not set"
                : `${product.stock.availableQuantity} available`}
            </small>
          </span>
        ),
      },
      {
        id: "supplier",
        header: "Supplier",
        mobileLabel: "Supplier",
        render: (product) => product.preferredSupplier?.supplier?.name || "Not linked",
      },
      {
        id: "visibility",
        header: "Visibility",
        mobileLabel: "Visibility",
        render: (product) => (
          <span className="admin-products-table__visibility">
            <ERPStatusBadge tone={getPublishingTone(product.publishingStatus)}>
              {formatStatus(product.publishingStatus)}
            </ERPStatusBadge>
            {product.isFeatured ? <small>Featured</small> : null}
          </span>
        ),
      },
      {
        id: "updated",
        header: "Updated",
        mobileLabel: "Updated",
        hideOnMobile: true,
        render: (product) => formatDateTime(product.updatedAt),
      },
    ],
    []
  );

  if (!session) return null;

  return (
    <section className="admin-products-page">
      <header className="admin-products-head">
        <div>
          <span className="admin-products-kicker">
            <HiOutlineShoppingBag aria-hidden="true" />
            Stroane admin
          </span>
          <h1>Product operations</h1>
          <p>Prepare catalogue copy, media paths, suppliers, and publishing state.</p>
        </div>
        <ERPSecondaryAction
          icon={<HiOutlineRefresh />}
          onClick={loadProducts}
          disabled={loading}
        >
          Refresh
        </ERPSecondaryAction>
      </header>

      <div className="admin-products-summary" aria-label="Product operations summary">
        <span><small>Products</small><strong>{summary.total}</strong></span>
        <span><small>Active</small><strong>{summary.active}</strong></span>
        <span><small>Drafts</small><strong>{summary.draft}</strong></span>
        <span><small>Stock attention</small><strong>{summary.attention}</strong></span>
      </div>

      {error ? <ERPFormNotice tone="danger" title="Product operations unavailable">{error}</ERPFormNotice> : null}
      {notice ? <ERPFormNotice tone="success" title="Saved">{notice}</ERPFormNotice> : null}

      <ERPTable
        className="admin-products-table"
        title="Catalogue products"
        description="Search, review, and prepare products before publishing them to the storefront."
        rows={products}
        columns={columns}
        rowKey="id"
        dense
        mobileMode="cards"
        state={loading ? "loading" : error && !products.length ? "error" : "ready"}
        loadingMessage="Loading products..."
        emptyTitle="No catalogue products found"
        emptyMessage="Try adjusting the product filters or seed the catalogue database."
        errorMessage={error}
        search={
          <ERPTableSearch
            label="Search products"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, SKU, slug, or brand"
          />
        }
        filters={
          <ERPTableFilters>
            <ERPSelectField
              aria-label="Filter publishing state"
              value={publishingStatus}
              onChange={(event) => setPublishingStatus(event.target.value)}
              options={STATUS_OPTIONS}
            />
            <ERPSelectField
              aria-label="Filter category"
              value={categorySlug}
              onChange={(event) => setCategorySlug(event.target.value)}
              options={[
                { value: "", label: "All categories" },
                ...categories.map((category) => ({ value: category.slug, label: category.name })),
              ]}
            />
            <ERPTextField
              aria-label="Filter tag"
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              placeholder="Filter tag"
            />
          </ERPTableFilters>
        }
        rowActions={(product) => (
          <ERPSecondaryAction
            size="sm"
            icon={isAdmin ? <HiOutlinePencil /> : <HiOutlineEye />}
            onClick={() => openProduct(product.id)}
          >
            {isAdmin ? "Edit" : "View"}
          </ERPSecondaryAction>
        )}
      />

      <ERPDrawer
        open={Boolean(selectedProduct)}
        title={selectedProduct?.name}
        description={isAdmin ? "Edit product operations data." : "Review product operations data."}
        onClose={closeEditor}
        side="right"
        footer={
          <ERPActionBar>
            <ERPSecondaryAction onClick={closeEditor}>Close</ERPSecondaryAction>
            {isAdmin ? (
              <ERPPrimaryAction
                form="admin-product-editor"
                type="submit"
                loading={saving}
                loadingLabel="Saving"
                icon={<HiOutlineSave />}
              >
                Save product
              </ERPPrimaryAction>
            ) : null}
          </ERPActionBar>
        }
      >
        {detailLoading || !draft || !selectedProduct ? (
          <p className="admin-products-drawer__loading">Loading product details...</p>
        ) : (
          <ERPForm id="admin-product-editor" onSubmit={submitProduct} busy={saving}>
            <ERPFormSection title="Catalogue details" description="Customer-facing copy and classification.">
              <ERPTextField label="Name" required value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} disabled={!isAdmin} />
              <ERPTextField label="Slug" required value={draft.slug} onChange={(event) => updateDraft("slug", event.target.value)} disabled={!isAdmin} />
              <ERPFormRow columns={2}>
                <ERPTextField label="SKU" value={draft.sku} onChange={(event) => updateDraft("sku", event.target.value)} disabled={!isAdmin} />
                <ERPSelectField
                  label="Category"
                  value={draft.categorySlug}
                  onChange={(event) => updateDraft("categorySlug", event.target.value)}
                  options={[
                    { value: "", label: "Uncategorized" },
                    ...categories.map((category) => ({ value: category.slug, label: category.name })),
                  ]}
                  disabled={!isAdmin}
                />
              </ERPFormRow>
              <ERPTextareaField label="Short description" value={draft.shortDescription} onChange={(event) => updateDraft("shortDescription", event.target.value)} disabled={!isAdmin} />
              <ERPTextareaField label="Full description" value={draft.longDescription} onChange={(event) => updateDraft("longDescription", event.target.value)} disabled={!isAdmin} />
              <ERPTextField label="Tags" helperText="Comma-separated customer-facing tags." value={draft.tags} onChange={(event) => updateDraft("tags", event.target.value)} disabled={!isAdmin} />
            </ERPFormSection>

            <ERPFormSection title="Pricing" description="Pricing remains separate from stock readiness.">
              <ERPFormRow columns={3}>
                <ERPTextField label="Price" type="number" min="0" step="0.01" value={draft.price} onChange={(event) => updateDraft("price", event.target.value)} disabled={!isAdmin} />
                <ERPTextField label="Compare-at price" type="number" min="0" step="0.01" value={draft.compareAtPrice} onChange={(event) => updateDraft("compareAtPrice", event.target.value)} disabled={!isAdmin} />
                <ERPTextField label="Currency" maxLength={3} value={draft.currency} onChange={(event) => updateDraft("currency", event.target.value.toUpperCase())} disabled={!isAdmin} />
              </ERPFormRow>
            </ERPFormSection>

            <ERPFormSection title="Media paths" description="Use mapped local assets. Direct uploads are intentionally deferred.">
              <div className="admin-products-media-preview">
                <ProductImagePreview path={draft.thumbnailImage} alt={`Preview for ${draft.name}`} />
              </div>
              <ERPTextField
                label="Thumbnail image path"
                helperText="Use /imgs/products/... with an image extension."
                value={draft.thumbnailImage}
                onChange={(event) => updateDraft("thumbnailImage", event.target.value)}
                disabled={!isAdmin}
              />
              <ERPTextareaField
                label="Gallery image paths"
                helperText="One /imgs/products/... path per line. Maximum 12 images."
                value={draft.galleryImages}
                onChange={(event) => updateDraft("galleryImages", event.target.value)}
                disabled={!isAdmin}
              />
              <div className="admin-products-gallery-preview" aria-label="Gallery preview">
                {getGalleryPreviewPaths(draft.galleryImages).map((path) => (
                  <span key={path}><ProductImagePreview path={path} alt="" /></span>
                ))}
              </div>
            </ERPFormSection>

            <ERPFormSection title="Publishing" description="Draft and archived products stay out of the public API.">
              <ERPSelectField
                label="Publishing state"
                value={draft.publishingStatus}
                onChange={(event) => updateDraft("publishingStatus", event.target.value as ProductDraft["publishingStatus"])}
                options={STATUS_OPTIONS.filter((option) => option.value)}
                disabled={!isAdmin}
              />
              <label className="admin-products-checkbox">
                <input type="checkbox" checked={draft.isFeatured} onChange={(event) => updateDraft("isFeatured", event.target.checked)} disabled={!isAdmin} />
                <span>Feature this product in catalogue highlights</span>
              </label>
            </ERPFormSection>

            <ERPFormSection title="Preferred supplier" description="Internal supplier details never enter public catalogue responses.">
              <ERPSelectField
                label="Supplier"
                value={draft.supplierId}
                onChange={(event) => updateDraft("supplierId", event.target.value)}
                options={[
                  { value: "", label: "No preferred supplier" },
                  ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
                ]}
                disabled={!isAdmin}
              />
              <ERPTextField label="Supplier product code" value={draft.supplierSku} onChange={(event) => updateDraft("supplierSku", event.target.value)} disabled={!isAdmin} />
              <ERPTextareaField label="Supplier notes" value={draft.supplierNotes} onChange={(event) => updateDraft("supplierNotes", event.target.value)} disabled={!isAdmin} />
            </ERPFormSection>

            <ERPFormSection title="Inventory visibility" description="Adjust stock from the inventory workflow.">
              <dl className="admin-products-stock-grid">
                <div><dt>Available</dt><dd>{selectedProduct.stock.availableQuantity ?? "Not set"}</dd></div>
                <div><dt>Reserved</dt><dd>{selectedProduct.stock.reservedQuantity ?? 0}</dd></div>
                <div><dt>Reorder threshold</dt><dd>{selectedProduct.stock.reorderThreshold ?? "Not set"}</dd></div>
                <div><dt>Stock state</dt><dd>{formatStatus(selectedProduct.stock.stockStatus)}</dd></div>
              </dl>
            </ERPFormSection>

            {isAdmin ? <ERPFormActions><ERPPrimaryAction type="submit" icon={<HiOutlinePhotograph />} loading={saving}>Save changes</ERPPrimaryAction></ERPFormActions> : null}
          </ERPForm>
        )}
      </ERPDrawer>
    </section>
  );
};

export default AdminProducts;
