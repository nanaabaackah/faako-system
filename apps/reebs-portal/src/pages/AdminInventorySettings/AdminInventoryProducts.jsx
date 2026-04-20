/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SelectField } from "@faako/ui";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import { InlineNotice } from "../../components/InlineNotice/InlineNotice";
import { AppIcon } from "../../components/Icon/Icon";
import {
  faPen,
  faArrowRight,
  faEye,
  faEyeSlash,
  faTrash,
} from "../../icons/iconSet";
import "./AdminInventorySettings.css";

const sourceCategoriesUrl = "/.netlify/functions/sourceCategories?includeInactive=1";
const specificCategoriesUrl = "/.netlify/functions/specificCategories";

const toArray = (value) => (Array.isArray(value) ? value : []);
const normalizeSourceToken = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const singularSourceToken = (value) => normalizeSourceToken(value).replace(/S$/, "");

const getSourceTokens = (source) => {
  const tokens = [
    source?.sourceCategoryCode,
    source?.source_category_code,
    source?.slug,
    source?.name,
    source?.sourceCategoryName,
    source?.sourceCategorySlug,
  ]
    .map(normalizeSourceToken)
    .filter(Boolean);
  const singularTokens = tokens.map(singularSourceToken).filter(Boolean);
  return new Set([...tokens, ...singularTokens]);
};

const readApiError = async (response, fallback) => {
  const text = await response.text().catch(() => "");
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    return parsed?.error || parsed?.message || fallback;
  } catch {
    return text || fallback;
  }
};

const apiRequest = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, "The inventory setup request failed."));
  }
  return response.json();
};

const categoryLabel = (category) => String(category?.name || "Untitled").trim() || "Untitled";

function AdminInventoryProducts() {
  const [sourceCategories, setSourceCategories] = useState([]);
  const [specificCategories, setSpecificCategories] = useState([]);
  const [sourceName, setSourceName] = useState("");
  const [specificName, setSpecificName] = useState("");
  const [specificSourceId, setSpecificSourceId] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedProductData, setSelectedProductData] = useState(null);

  const activeSourceCategories = useMemo(
    () => sourceCategories.filter((category) => category.isActive !== false),
    [sourceCategories]
  );

  const sourceById = useMemo(() => {
    const map = new Map();
    sourceCategories.forEach((category) => {
      map.set(String(category.id), category);
    });
    return map;
  }, [sourceCategories]);

  const sourceByToken = useMemo(() => {
    const map = new Map();
    sourceCategories.forEach((source) => {
      getSourceTokens(source).forEach((token) => {
        if (!map.has(token)) map.set(token, source);
      });
    });
    return map;
  }, [sourceCategories]);

  const resolveSpecificSource = useCallback(
    (category) => {
      const byId = sourceById.get(String(category?.sourceCategoryId || ""));
      if (byId) return byId;
      const tokens = getSourceTokens(category);
      for (const token of tokens) {
        const byToken = sourceByToken.get(token);
        if (byToken) return byToken;
      }
      return null;
    },
    [sourceById, sourceByToken]
  );

  const filteredSpecificCategories = useMemo(() => {
    if (sourceFilter === "all") return specificCategories;
    const selectedSource = sourceById.get(sourceFilter);
    const selectedTokens = getSourceTokens(selectedSource);
    return specificCategories.filter((category) => {
      if (String(category.sourceCategoryId || "") === sourceFilter) return true;
      const categoryTokens = getSourceTokens(category);
      return Array.from(categoryTokens).some((token) => selectedTokens.has(token));
    });
  }, [sourceById, sourceFilter, specificCategories]);

  const loadSetup = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sourceResponse, specificResponse] = await Promise.all([
        fetch(sourceCategoriesUrl),
        fetch(specificCategoriesUrl),
      ]);
      if (!sourceResponse.ok) {
        throw new Error(await readApiError(sourceResponse, "Products could not be loaded."));
      }
      if (!specificResponse.ok) {
        throw new Error(await readApiError(specificResponse, "Categories could not be loaded."));
      }
      const [sourceData, specificData] = await Promise.all([
        sourceResponse.json(),
        specificResponse.json(),
      ]);
      setSourceCategories(toArray(sourceData));
      setSpecificCategories(toArray(specificData));
      const firstActive = toArray(sourceData).find((category) => category.isActive !== false);
      setSpecificSourceId((current) => current || (firstActive?.id ? String(firstActive.id) : ""));
    } catch (err) {
      setError(err.message || "Inventory setup could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSetup();
  }, [loadSetup]);

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  const runAction = async (label, action, message) => {
    setSaving(label);
    setError("");
    setSuccess("");
    try {
      await action();
      await loadSetup();
      setSuccess(message);
    } catch (err) {
      setError(err.message || "The inventory setup update failed.");
    } finally {
      setSaving("");
    }
  };

  const handleCreateSource = (event) => {
    event.preventDefault();
    const name = sourceName.trim();
    if (!name) {
      setError("Enter a product name.");
      return;
    }
    runAction(
      "source:create",
      async () => {
        const created = await apiRequest("/.netlify/functions/sourceCategories", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        setSourceName("");
        setSpecificSourceId(String(created?.id || ""));
      },
      "Product saved."
    );
  };

  const handleRenameSource = (category) => {
    const nextName = window.prompt("Rename product", categoryLabel(category));
    if (!nextName || nextName.trim() === categoryLabel(category)) return;
    runAction(
      `source:${category.id}`,
      () => apiRequest("/.netlify/functions/sourceCategories", {
        method: "PATCH",
        body: JSON.stringify({ id: category.id, name: nextName.trim() }),
      }),
      "Product updated."
    );
  };

  const handleToggleSource = (category) => {
    const nextActive = category.isActive === false;
    const verb = nextActive ? "restore" : "disable";
    if (!window.confirm(`Do you want to ${verb} ${categoryLabel(category)}?`)) return;
    runAction(
      `source:${category.id}`,
      () => apiRequest("/.netlify/functions/sourceCategories", {
        method: "PATCH",
        body: JSON.stringify({ id: category.id, isActive: nextActive }),
      }),
      nextActive ? "Product restored." : "Product disabled."
    );
  };

  const handleDeleteSource = async (category) => {
    if (category.itemCount && category.itemCount > 0) {
      const moveToAnother = window.confirm(
        `This product has ${category.itemCount} item(s). Move them to another product before deleting?`
      );
      if (moveToAnother) {
        handleMoveSourceItems(category);
        return;
      }
    }
    if (!window.confirm(`Delete "${categoryLabel(category)}" permanently? This cannot be undone.`)) return;
    runAction(
      `source:${category.id}`,
      () => apiRequest("/.netlify/functions/sourceCategories", {
        method: "DELETE",
        body: JSON.stringify({ id: category.id }),
      }),
      "Product deleted."
    );
  };

  const handleMoveSourceItems = (sourceCategory) => {
    const otherCategories = sourceCategories.filter(
      (cat) => cat.id !== sourceCategory.id && cat.isActive !== false
    );
    if (otherCategories.length === 0) {
      setError("Create another active product before moving items.");
      return;
    }
    const targetName = window.prompt(
      `Move ${sourceCategory.itemCount} item(s) to which product?\n\nAvailable: ${otherCategories.map(categoryLabel).join(", ")}`
    );
    if (!targetName) return;
    const targetCategory = otherCategories.find(
      (cat) => categoryLabel(cat).toLowerCase() === targetName.trim().toLowerCase()
    );
    if (!targetCategory) {
      setError("That product was not found.");
      return;
    }
    runAction(
      `source:${sourceCategory.id}:delete`,
      () => apiRequest("/.netlify/functions/sourceCategories", {
        method: "DELETE",
        body: JSON.stringify({
          id: sourceCategory.id,
          moveItemsTo: targetCategory.id,
        }),
      }),
      `Product deleted and ${sourceCategory.itemCount} item(s) moved to ${categoryLabel(targetCategory)}.`
    );
  };

  const handleCreateSpecific = (event) => {
    event.preventDefault();
    const name = specificName.trim();
    const source = sourceById.get(String(specificSourceId));
    if (!source) {
      setError("Choose the product this category belongs to.");
      return;
    }
    if (!name) {
      setError("Enter a category name.");
      return;
    }
    runAction(
      "specific:create",
      async () => {
        await apiRequest("/.netlify/functions/specificCategories", {
          method: "POST",
          body: JSON.stringify({
            name,
            sourceCategoryId: source.id,
            sourceCategoryName: source.name,
            sourceCategoryCode: source.sourceCategoryCode,
          }),
        });
        setSpecificName("");
      },
      "Category saved."
    );
  };

  const handleRenameSpecific = (category) => {
    const nextName = window.prompt("Rename category", categoryLabel(category));
    if (!nextName || nextName.trim() === categoryLabel(category)) return;
    runAction(
      `specific:${category.id}`,
      () => apiRequest(specificCategoriesUrl, {
        method: "PATCH",
        body: JSON.stringify({ id: category.id, name: nextName.trim() }),
      }),
      "Category updated."
    );
  };

  const handleMoveSpecific = (category) => {
    const currentSource = sourceById.get(String(category.sourceCategoryId));
    const nextName = window.prompt(
      "Move to product",
      currentSource?.name || activeSourceCategories[0]?.name || ""
    );
    if (!nextName) return;
    const nextSource = sourceCategories.find(
      (source) => categoryLabel(source).toLowerCase() === nextName.trim().toLowerCase()
    );
    if (!nextSource) {
      setError("That product does not exist yet. Add it first, then move the category.");
      return;
    }

    // Check if a category with the same name already exists in the target source
    // Use specificCategories (full list) instead of filteredSpecificCategories
    // so we can see all categories in the target source, not just filtered ones
    const existingInTarget = specificCategories.find(
      (cat) =>
        cat.id !== category.id &&
        cat.sourceCategoryId === nextSource.id &&
        categoryLabel(cat).toLowerCase() === categoryLabel(category).toLowerCase()
    );

    if (existingInTarget) {
      // If moving to a source where the same category name already exists,
      // merge by moving items to the existing category and deleting this one
      if (category.itemCount && category.itemCount > 0) {
        if (!window.confirm(
          `A "${categoryLabel(category)}" category already exists under ${nextSource.name}. Move its ${category.itemCount} item(s) there and delete this one?`
        )) {
          return;
        }
      }
      // Merge: delete this category and move items to the existing one
      runAction(
        `specific:${category.id}:merge`,
        () => apiRequest(specificCategoriesUrl, {
          method: "DELETE",
          body: JSON.stringify({
            id: category.id,
            moveItemsTo: existingInTarget.id,
          }),
        }),
        `Category merged. Items moved to ${categoryLabel(existingInTarget)}.`
      );
      return;
    }

    // Normal move: update the source category
    runAction(
      `specific:${category.id}`,
      () => apiRequest(specificCategoriesUrl, {
        method: "PATCH",
        body: JSON.stringify({
          id: category.id,
          sourceCategoryId: nextSource.id,
          sourceCategoryName: nextSource.name,
          sourceCategoryCode: nextSource.sourceCategoryCode,
        }),
      }),
      "Category moved."
    );
  };

  const handleToggleSpecific = (category) => {
    const nextActive = category.isActive === false;
    const verb = nextActive ? "restore" : "disable";
    if (!window.confirm(`Do you want to ${verb} ${categoryLabel(category)}?`)) return;
    runAction(
      `specific:${category.id}`,
      () => apiRequest(specificCategoriesUrl, {
        method: "PATCH",
        body: JSON.stringify({ id: category.id, isActive: nextActive }),
      }),
      nextActive ? "Category restored." : "Category disabled."
    );
  };

  const handleDeleteSpecific = (category) => {
    if (category.itemCount && category.itemCount > 0) {
      const moveToAnother = window.confirm(
        `This category has ${category.itemCount} item(s). Move them to another category before deleting?`
      );
      if (moveToAnother) {
        handleMoveSpecificItems(category);
        return;
      }
    }
    if (!window.confirm(`Delete "${categoryLabel(category)}" permanently? This cannot be undone.`)) return;
    runAction(
      `specific:${category.id}`,
      () => apiRequest(specificCategoriesUrl, {
        method: "DELETE",
        body: JSON.stringify({ id: category.id }),
      }),
      "Category deleted."
    );
  };

  const handleMoveSpecificItems = (specificCategory) => {
    const source = resolveSpecificSource(specificCategory);
    const otherCategories = filteredSpecificCategories.filter(
      (cat) => cat.id !== specificCategory.id && cat.isActive !== false
    );
    if (otherCategories.length === 0) {
      setError("Create another active category in this product before moving items.");
      return;
    }
    const targetName = window.prompt(
      `Move ${specificCategory.itemCount} item(s) to which category?\n\nAvailable: ${otherCategories.map(categoryLabel).join(", ")}`
    );
    if (!targetName) return;
    const targetCategory = otherCategories.find(
      (cat) => categoryLabel(cat).toLowerCase() === targetName.trim().toLowerCase()
    );
    if (!targetCategory) {
      setError("That category was not found.");
      return;
    }
    runAction(
      `specific:${specificCategory.id}:delete`,
      () => apiRequest(specificCategoriesUrl, {
        method: "DELETE",
        body: JSON.stringify({
          id: specificCategory.id,
          moveItemsTo: targetCategory.id,
        }),
      }),
      `Category deleted and ${specificCategory.itemCount} item(s) moved to ${categoryLabel(targetCategory)}.`
    );
  };

  const handleShowProductData = (category) => {
    setSelectedProductData(category);
  };

  return (
    <div className="admin-page inventory-admin-settings-page">
      <div className="admin-shell">
        <AdminBreadcrumb items={[{ label: "Inventory", to: "/admin/inventory" }, { label: "Product setup" }]} />
        <AdminPageHeader
          title="Product setup"
          subtitle="Manage the products and categories used by inventory records."
          actionsClassName="inventory-admin-settings-actions"
          actions={
            <Link to="/admin/inventory" className="admin-secondary inventory-admin-settings-back">
              Back to stock
            </Link>
          }
        />

        {loading && <InlineNotice tone="loading" message="Loading inventory setup data." />}
        {error && <InlineNotice tone="error" message={error} />}
        {success && <InlineNotice tone="success" message={success} />}

        <section className="inventory-admin-settings-grid" aria-label="Inventory product setup">
          <article className="settings-panel inventory-admin-settings-panel">
            <div className="inventory-admin-settings-panel-head">
              <div>
                  <h2>Categories</h2>
                  <p>These are the product groups used by the item modal and bulk move tools.</p>
              </div>
            </div>

            <form className="inventory-admin-settings-form inventory-admin-settings-form--inline" onSubmit={handleCreateSource}>
              <label>
                Category
                <input
                  value={sourceName}
                  onChange={(event) => setSourceName(event.target.value)}
                  placeholder="Add product"
                  disabled={saving === "source:create"}
                />
              </label>
              <button type="submit" className="admin-primary" disabled={saving === "source:create"}>
                {saving === "source:create" ? "Saving..." : "Add"}
              </button>
            </form>

            <div className="inventory-admin-settings-list">
              {sourceCategories.length ? sourceCategories.map((category) => (
                <div
                  key={category.id}
                  className={`inventory-admin-settings-row${category.isActive === false ? " is-inactive" : ""}`}
                >
                  <span className="inventory-admin-settings-row-main">
                    <strong>{categoryLabel(category)}</strong>
                    <span>
                      {category.sourceCategoryCode || category.slug || "No code"} · {category.itemCount || 0} items
                    </span>
                  </span>
                  <span className="inventory-admin-settings-row-actions">
                    <button type="button" title="Rename" onClick={() => handleRenameSource(category)} className="inventory-admin-settings-icon-button">
                      <AppIcon icon={faPen} size={18} />
                    </button>
                    <button
                      type="button"
                      title={category.isActive === false ? "Restore" : "Disable"}
                      className={`inventory-admin-settings-icon-button ${category.isActive === false ? "" : "danger"}`}
                      onClick={() => handleToggleSource(category)}
                    >
                      <AppIcon icon={category.isActive === false ? faEye : faEyeSlash} size={18} />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      className="inventory-admin-settings-icon-button danger"
                      onClick={() => handleDeleteSource(category)}
                      disabled={saving.startsWith(`source:${category.id}`)}
                    >
                      <AppIcon icon={faTrash} size={18} />
                    </button>
                  </span>
                </div>
              )) : (
                <p className="inventory-admin-settings-empty">No products were returned from the database.</p>
              )}
            </div>
          </article>

          <article className="settings-panel inventory-admin-settings-panel">
            <div className="inventory-admin-settings-panel-head">
              <div>
                <h2>Product</h2>
                <p>Products stay linked to a category and filter by that product anywhere they are used.</p>
              </div>
            </div>

            <form className="inventory-admin-settings-form" onSubmit={handleCreateSpecific}>
              <label>
                Category
                <SelectField
                  value={specificSourceId}
                  onChangeValue={(nextValue) => setSpecificSourceId(String(nextValue))}
                  ariaLabel="Choose category"
                >
                  <option value="">Choose category</option>
                  {activeSourceCategories.map((category) => (
                    <option key={category.id} value={String(category.id)}>
                      {categoryLabel(category)}
                    </option>
                  ))}
                </SelectField>
              </label>
              <label>
                Product
                <input
                  value={specificName}
                  onChange={(event) => setSpecificName(event.target.value)}
                  placeholder="Add Product"
                  disabled={saving === "specific:create"}
                />
              </label>
              <div className="admin-form-actions">
                <button type="submit" className="admin-primary" disabled={saving === "specific:create"}>
                  {saving === "specific:create" ? "Saving..." : "Add category"}
                </button>
              </div>
            </form>

            <div className="inventory-admin-settings-list">
                {filteredSpecificCategories.length ? filteredSpecificCategories.map((category) => {
                const source = resolveSpecificSource(category);

                return (
                  <div
                    key={`${category.source || "category"}-${category.id}`}
                    className={`inventory-admin-settings-row${category.isActive === false ? " is-inactive" : ""}`}
                  >
                    <span className="inventory-admin-settings-row-main">
                      <strong>{categoryLabel(category)}</strong>
                      <span>
                        {source?.name || category.sourceCategoryName || category.sourceCategoryCode || "Unlinked"} ·{" "}
                        {category.itemCount || 0} items
                      </span>
                    </span>
                    <span className="inventory-admin-settings-row-actions">
                      <button type="button" title="Rename" onClick={() => handleRenameSpecific(category)} className="inventory-admin-settings-icon-button">
                        <AppIcon icon={faPen} size={18} />
                      </button>
                      <button type="button" title="Move" onClick={() => handleMoveSpecific(category)} className="inventory-admin-settings-icon-button">
                        <AppIcon icon={faArrowRight} size={18} />
                      </button>
                      <button
                        type="button"
                        title={category.isActive === false ? "Restore" : "Disable"}
                        className={`inventory-admin-settings-icon-button ${category.isActive === false ? "" : "danger"}`}
                        onClick={() => handleToggleSpecific(category)}
                      >
                        <AppIcon icon={category.isActive === false ? faEye : faEyeSlash} size={18} />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        className="inventory-admin-settings-icon-button danger"
                        onClick={() => handleDeleteSpecific(category)}
                        disabled={saving.startsWith(`specific:${category.id}`)}
                      >
                        <AppIcon icon={faTrash} size={18} />
                      </button>
                    </span>
                  </div>
                );
              }) : (
                <p className="inventory-admin-settings-empty">No categories match this product.</p>
              )}
            </div>
          </article>
        </section>

        {selectedProductData && (
          <div
            className="inventory-admin-product-data-modal"
            onClick={() => setSelectedProductData(null)}
          >
            <div
              className="inventory-admin-product-data-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="inventory-admin-product-data-modal-header">
                <h3>Product Data: {categoryLabel(selectedProductData)}</h3>
                <button
                  type="button"
                  className="inventory-admin-product-data-close"
                  onClick={() => setSelectedProductData(null)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="inventory-admin-product-data-modal-body">
                <div className="inventory-admin-product-data-field">
                  <span className="inventory-admin-product-data-label">Product ID:</span>
                  <span className="inventory-admin-product-data-value">{selectedProductData.id}</span>
                </div>
                <div className="inventory-admin-product-data-field">
                  <span className="inventory-admin-product-data-label">Name:</span>
                  <span className="inventory-admin-product-data-value">{categoryLabel(selectedProductData)}</span>
                </div>
                <div className="inventory-admin-product-data-field">
                  <span className="inventory-admin-product-data-label">Slug:</span>
                  <span className="inventory-admin-product-data-value">{selectedProductData.slug || "—"}</span>
                </div>
                <div className="inventory-admin-product-data-field">
                  <span className="inventory-admin-product-data-label">Source Category:</span>
                  <span className="inventory-admin-product-data-value">
                    {selectedProductData.sourceCategoryName || selectedProductData.sourceCategoryCode || "—"}
                  </span>
                </div>
                <div className="inventory-admin-product-data-field">
                  <span className="inventory-admin-product-data-label">Source Code:</span>
                  <span className="inventory-admin-product-data-value">{selectedProductData.sourceCategoryCode || "—"}</span>
                </div>
                <div className="inventory-admin-product-data-field">
                  <span className="inventory-admin-product-data-label">Active:</span>
                  <span className="inventory-admin-product-data-value">
                    {selectedProductData.isActive !== false ? "Yes" : "No"}
                  </span>
                </div>
                <div className="inventory-admin-product-data-field">
                  <span className="inventory-admin-product-data-label">Items:</span>
                  <span className="inventory-admin-product-data-value">{selectedProductData.itemCount || 0}</span>
                </div>
                <div className="inventory-admin-product-data-field">
                  <span className="inventory-admin-product-data-label">Source Type:</span>
                  <span className="inventory-admin-product-data-value">
                    {selectedProductData.source === "product" ? "Auto-generated from database" : "Custom category"}
                  </span>
                </div>
                {selectedProductData.createdAt && (
                  <div className="inventory-admin-product-data-field">
                    <span className="inventory-admin-product-data-label">Created:</span>
                    <span className="inventory-admin-product-data-value">
                      {new Date(selectedProductData.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
              <div className="inventory-admin-product-data-modal-footer">
                <button
                  type="button"
                  className="admin-secondary"
                  onClick={() => setSelectedProductData(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminInventoryProducts;
