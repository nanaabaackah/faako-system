/* eslint-disable no-unused-vars */
import React from "react";
import { OfflineStatusBadge } from "@faako/offline-sync";
import { SelectField } from "@faako/ui";
import SearchField from "../../../components/SearchField/SearchField";
import { InlineNoticeStack } from "../../../components/InlineNotice/InlineNotice";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faArrowLeft,
  faClock,
  faMinus,
  faMoneyBillWave,
  faPlus,
  faRotateRight,
  faTrash,
  faXmark,
} from "/src/icons/iconSet";
import { getCatalogItemImage } from "../../../utils/itemMediaBackgrounds";
import {
  DISCOUNT_OPTIONS,
  LOW_STOCK_THRESHOLD,
  PAYMENT_OPTIONS,
  buildVariantOptionLabel,
  findVariantById,
  formatMoney,
  getAvailableQuantity,
  getActiveItemVariants,
  getCategory,
  getCustomerLabel,
  getCustomerMeta,
  getQuantity,
  getProductLineKey,
  getUnitPrice,
  getVariantAvailableQty,
  getVariantUnitPrice,
  isVariantParentItem,
} from "../storeModeShared";

const STOCK_FILTER_OPTIONS = [
  { id: "all", label: "All" },
  { id: "in", label: "In stock" },
  { id: "low", label: "Low" },
  { id: "out", label: "Out" },
];

const COMPACT_SEARCH_LAYOUT_WIDTH = 760;

function StoreModeHeader({ onExit, onRefresh, loading, isOnline }) {
  return (
    <header className="store-mode-topbar">
      <button type="button" className="store-mode-exit" onClick={onExit}>
        <AppIcon icon={faArrowLeft} />
        <span className="store-mode-exit-label store-mode-exit-label--full">Leave Store Mode</span>
        <span className="store-mode-exit-label store-mode-exit-label--short">Exit</span>
      </button>
      <div className="store-mode-topbar-copy">
        <h1>Point of sale</h1>
      </div>
      <div className="store-mode-topbar-actions">
        <OfflineStatusBadge online={isOnline} />
        <button
          type="button"
          className="store-mode-refresh store-mode-refresh--icon"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh inventory"
          title="Refresh inventory"
        >
          <AppIcon icon={faRotateRight} />
        </button>
      </div>
    </header>
  );
}

function StoreModeFeedback({ loading, error, submitError, success, isOnline, draftStatus }) {
  const hasLocalDraft = Boolean(draftStatus?.type);
  const notices = [
    loading
      ? {
          key: "loading",
          tone: "loading",
          title: "Loading store mode",
          message: "Fetching the latest inventory and customers.",
        }
      : null,
    !loading && error
      ? {
          key: "inventory-error",
          tone: "error",
          title: "Inventory unavailable",
          message: error,
        }
      : null,
    submitError
      ? {
          key: "submit-error",
          tone: "error",
          title: "Sale not recorded",
          message: submitError,
        }
      : null,
    success
      ? {
          key: "submit-success",
          tone: "success",
          title: "Sale saved",
          message: success,
        }
      : null,
    hasLocalDraft && draftStatus.type === "restored"
      ? {
          key: "draft-restored",
          tone: "info",
          title: "Unsaved local draft restored",
          message: "Review the POS draft before submitting. The server will still validate the final sale.",
        }
      : null,
    hasLocalDraft && draftStatus.type !== "restored" && !isOnline
      ? {
          key: "draft-offline",
          tone: "info",
          title: "Offline",
          message: "Draft saved locally. Submit the sale only after the connection is stable.",
        }
      : null,
    hasLocalDraft && draftStatus.type !== "restored" && isOnline
      ? {
          key: "draft-saved",
          tone: "success",
          title: "Draft saved locally",
          message: "Online - ready to submit. Final validation still happens on the server.",
        }
      : null,
  ];

  return <InlineNoticeStack notices={notices} className="store-mode-feedback" />;
}

function StoreModeInventoryPanel({
  search,
  onSearchChange,
  onSearchClear,
  stockFilter,
  onStockFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  categories,
  sortKey,
  sortHeaderClassName,
  requestSort,
  sortIndicator,
  loading,
  hasSearchQuery,
  visibleItems,
  emptyStateMessage,
  sortedVisibleItems,
  orderQtyByLineKey,
  orderQtyByProductId,
  selectedProductId,
  selectedVariantIds,
  onSelectVariant,
  isMobileViewport,
  showImagePreview,
  hideImagePreview,
  addToOrder,
}) {
  const inventoryPanelRef = React.useRef(null);
  const [isCompactSearchLayout, setIsCompactSearchLayout] = React.useState(isMobileViewport);
  const inventoryTableSummary = React.useMemo(() => {
    return sortedVisibleItems.reduce(
      (accumulator, item) => {
        accumulator.count += 1;
        accumulator.stock += getQuantity(item);
        accumulator.price += getUnitPrice(item);
        return accumulator;
      },
      { count: 0, stock: 0, price: 0 }
    );
  }, [sortedVisibleItems]);

  React.useEffect(() => {
    const panelNode = inventoryPanelRef.current;
    if (!panelNode || typeof ResizeObserver === "undefined") {
      setIsCompactSearchLayout(isMobileViewport);
      return undefined;
    }

    const syncCompactLayout = (width) => {
      setIsCompactSearchLayout(isMobileViewport || width <= COMPACT_SEARCH_LAYOUT_WIDTH);
    };

    syncCompactLayout(panelNode.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect?.width ?? panelNode.getBoundingClientRect().width;
      syncCompactLayout(nextWidth);
    });

    observer.observe(panelNode);
    return () => observer.disconnect();
  }, [isMobileViewport]);

  return (
    <section className="store-mode-surface store-mode-surface--inventory" ref={inventoryPanelRef}>
      <div className="store-mode-toolbar">
        <SearchField
          className="store-mode-search"
          value={search}
          onChange={onSearchChange}
          onClear={onSearchClear}
          placeholder="Search item"
          aria-label="Search stock"
        />

        <div className="store-mode-filter-row" role="group" aria-label="Stock filter">
          {STOCK_FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`store-mode-filter-btn ${stockFilter === option.id ? "is-active" : ""}`}
              onClick={() => onStockFilterChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="store-mode-category">
          <span>Category</span>
          <SelectField
            value={categoryFilter}
            onChangeValue={(nextValue) => onCategoryFilterChange({ target: { value: String(nextValue) } })}
            ariaLabel="Filter category"
            inputClassName="store-mode-select"
          >
            <option value="all">All</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </SelectField>
        </label>
      </div>

      {hasSearchQuery ? (
        <div className="store-mode-card-grid-wrap">
          {!loading && sortedVisibleItems.length === 0 && emptyStateMessage ? (
            <p className="store-mode-empty store-mode-empty--grid">{emptyStateMessage}</p>
          ) : (
            <div className="store-mode-card-grid">
              {sortedVisibleItems.map((item) => {
                const productId = Number(item.id);
                const currentQty = orderQtyByProductId.get(productId) || 0;
                const stock = getAvailableQuantity(item, orderQtyByLineKey);
                const isOut = stock <= 0;
                const isLow = !isOut && stock <= LOW_STOCK_THRESHOLD;
                const isSelected = selectedProductId === productId || currentQty > 0;
                const productName = item.name || "Untitled";
                const productImage = getCatalogItemImage(item);
                const variants = getActiveItemVariants(item);
                const selectedVariant =
                  findVariantById(item, selectedVariantIds[String(productId)]) ||
                  variants.find((v) => getVariantAvailableQty(v) > 0) ||
                  variants[0] ||
                  null;
                const selectedVariantLineKey = getProductLineKey(productId, selectedVariant?.id);
                const selectedVariantStock = selectedVariant
                  ? Math.max(0, getVariantAvailableQty(selectedVariant) - (orderQtyByLineKey.get(selectedVariantLineKey) || 0))
                  : 0;
                const hasVariantOptions = isVariantParentItem(item) && variants.length > 0;
                const productPrice = formatMoney(
                  hasVariantOptions && selectedVariant
                    ? getVariantUnitPrice(item, selectedVariant)
                    : getUnitPrice(item),
                  item.currency || "GHS"
                );
                const canAdd = hasVariantOptions ? selectedVariantStock > 0 : stock > 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`store-mode-item-card${isOut ? " is-out" : isLow ? " is-low" : ""}${isSelected ? " is-selected" : ""}`}
                    onClick={canAdd ? () => addToOrder(item, selectedVariant) : undefined}
                    disabled={!canAdd}
                    onMouseEnter={() => { if (!isMobileViewport) showImagePreview(productImage, productName); }}
                    onMouseLeave={() => { if (!isMobileViewport) hideImagePreview(); }}
                    onFocus={() => { if (!isMobileViewport) showImagePreview(productImage, productName); }}
                    onBlur={() => { if (!isMobileViewport) hideImagePreview(); }}
                    aria-label={`Add ${productName} to order`}
                  >
                    <div className="store-mode-item-card-img">
                      <img src={productImage} alt={productName} loading="lazy" />
                    </div>
                    <div className="store-mode-item-card-body">
                      <strong>{productName}</strong>
                      <span className="store-mode-item-card-price">{productPrice}</span>
                      <span className={`store-mode-stock-pill store-mode-item-card-stock${isOut ? " is-out" : isLow ? " is-low" : ""}`}>
                        {stock}
                      </span>
                    </div>
                    {hasVariantOptions && (
                      <div
                        className="store-mode-item-card-variant"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <SelectField
                          value={selectedVariant?.id ? String(selectedVariant.id) : ""}
                          onChangeValue={(nextValue) => onSelectVariant(productId, nextValue)}
                          ariaLabel={`Choose variant for ${productName}`}
                          inputClassName="store-mode-product-variant-select"
                        >
                          {variants.map((variant) => {
                            const lineKey = getProductLineKey(productId, variant.id);
                            const remaining = Math.max(0, getVariantAvailableQty(variant) - (orderQtyByLineKey.get(lineKey) || 0));
                            return (
                              <option key={variant.id} value={variant.id} disabled={remaining <= 0}>
                                {buildVariantOptionLabel(item, variant)} · {remaining} left
                              </option>
                            );
                          })}
                        </SelectField>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function StoreModeCustomerPanel({
  customerPickerRef,
  customerName,
  onCustomerNameChange,
  onCustomerFocus,
  onCustomerKeyDown,
  customerDropdownOpen,
  customersLoading,
  customerMatches,
  selectedCustomer,
  onSelectCustomer,
  showAddCustomerOption,
  onChooseAddCustomer,
  normalizedCustomerLookup,
  customerContact,
  onCustomerContactChange,
  customersError,
}) {
  return (
    <section className="glass-card store-builder-panel store-builder-panel--customer">
      <div className="store-builder-controls">
        <div className="store-builder-inline-fields">
          <label className="store-builder-field">
            <span>Customer</span>
            <div className="store-builder-customer-picker" ref={customerPickerRef}>
              <input
                type="text"
                value={customerName}
                onChange={onCustomerNameChange}
                onFocus={onCustomerFocus}
                onKeyDown={onCustomerKeyDown}
                placeholder="Select or add customer"
                autoComplete="off"
              />
              {customerDropdownOpen ? (
                <div className="store-builder-customer-menu" role="listbox" aria-label="Customer directory">
                  {customersLoading ? (
                    <div className="store-builder-customer-status">Loading customers...</div>
                  ) : (
                    <>
                      {customerMatches.map((customer) => {
                        const label = getCustomerLabel(customer);
                        return (
                          <button
                            key={customer.id}
                            type="button"
                            className={`store-builder-customer-option ${selectedCustomer?.id === customer.id ? "is-selected" : ""}`}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => onSelectCustomer(customer)}
                          >
                            {label}
                          </button>
                        );
                      })}

                      {showAddCustomerOption ? (
                        <button
                          type="button"
                          className="store-builder-customer-option is-create"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={onChooseAddCustomer}
                        >
                          <span
                            className="store-builder-customer-option-mark store-builder-customer-option-mark--create"
                            aria-hidden="true"
                          >
                            +
                          </span>
                          <span className="store-builder-customer-option-copy">
                            <strong>Add customer</strong>
                            <span>{normalizedCustomerLookup}</span>
                          </span>
                          <span className="store-builder-customer-option-tag store-builder-customer-option-tag--create">
                            New
                          </span>
                        </button>
                      ) : null}

                      {!customerMatches.length && !showAddCustomerOption ? (
                        <div className="store-builder-customer-status">No customers found.</div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>
            <small
              className={`store-builder-field-note ${customersError ? "is-error" : selectedCustomer?.id ? "is-valid" : ""}`}
            />
          </label>

          <label className="store-builder-field">
            <span>WhatsApp or email</span>
            <input
              type="text"
              value={customerContact}
              onChange={onCustomerContactChange}
              placeholder="Optional"
            />
          </label>
        </div>
      </div>
    </section>
  );
}

function StoreModeOrderPanel({
  itemCount,
  clearOrder,
  orderItems,
  inventoryById,
  submitting,
  removeFromOrder,
  clearLineFromOrder,
  addToOrder,
  subtotal,
  discountAmount,
  total,
  orderCurrency,
}) {
  return (
    <section className="glass-card store-builder-panel store-builder-panel--order">
      <div className="store-builder-summary">
        <div>
          <h2>{itemCount} items</h2>
        </div>
        <button
          type="button"
          className="store-builder-clear"
          onClick={clearOrder}
          disabled={!orderItems.length || submitting}
        >
          <AppIcon icon={faTrash} /> Clear
        </button>
      </div>

      <div className="store-builder-main">
        {orderItems.length ? (
          <div className="store-builder-order-list">
            {orderItems.map((item) => {
              const liveProduct = inventoryById.get(Number(item.productId));
              const liveVariant = item.variantId ? findVariantById(liveProduct, item.variantId) : null;
              const maxStock = liveVariant ? getVariantAvailableQty(liveVariant) : getQuantity(liveProduct || item);
              const lineKey = item.lineKey || getProductLineKey(item.productId, item.variantId);
              return (
                <div key={lineKey} className="store-builder-order-row">
                  <span className="store-builder-order-name">{item.productName || item.name}</span>
                  <div className="store-builder-order-actions">
                    <button
                      type="button"
                      className="store-mode-stepper-btn"
                      onClick={() => removeFromOrder(lineKey)}
                      disabled={submitting}
                      aria-label="Decrease"
                    >
                      <AppIcon icon={faMinus} />
                    </button>
                    <strong className="store-builder-order-qty">{item.quantity}</strong>
                    <button
                      type="button"
                      className="store-mode-stepper-btn"
                      onClick={() => liveProduct && addToOrder(liveProduct, liveVariant)}
                      disabled={submitting || !liveProduct || item.quantity >= maxStock}
                      aria-label="Increase"
                    >
                      <AppIcon icon={faPlus} />
                    </button>
                    <button
                      type="button"
                      className="store-mode-stepper-btn"
                      onClick={() => clearLineFromOrder(lineKey)}
                      disabled={submitting}
                      aria-label={`Remove ${item.name}`}
                    >
                      <AppIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="store-builder-empty store-builder-empty--inline">
            Tap items from the stock list to build the sale.
          </p>
        )}
      </div>

      <div className="store-builder-inline-totals store-builder-inline-totals--order" aria-label="Order totals">
        <div className="store-builder-inline-total">
          <span>Subtotal</span>
          <strong>{formatMoney(subtotal, orderCurrency)}</strong>
        </div>
        <div className="store-builder-inline-total">
          <span>Discount</span>
          <strong>-{formatMoney(discountAmount, orderCurrency)}</strong>
        </div>
        <div className="store-builder-inline-total store-builder-inline-total--strong">
          <span>Total</span>
          <strong>{formatMoney(total, orderCurrency)}</strong>
        </div>
      </div>
    </section>
  );
}

function StoreModeCartPanel({
  itemCount,
  orderItemsLength,
  discountAmount,
  total,
  orderCurrency,
  paymentMethod,
  onPaymentMethodChange,
  discountType,
  onDiscountTypeChange,
  discountValue,
  onDiscountValueChange,
  cashReceived,
  onCashReceivedChange,
  changeDue,
  momoReference,
  onMomoReferenceChange,
  submitSale,
  submitting,
  canCompleteSale,
  canPayLater,
  clearOrder,
}) {
  return (
    <section className="glass-card store-builder-panel store-builder-panel--cart">
      <div className="store-builder-section-head">
        <h3>Checkout</h3>
      </div>
      <div className="store-builder-summary store-builder-summary--checkout">
        <span className="store-builder-summary-meta">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="store-builder-payment-stack">
        <div className="store-builder-methods" role="group" aria-label="Payment method">
          {PAYMENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`store-builder-method ${paymentMethod === option.value ? "is-active" : ""}`}
              onClick={() => onPaymentMethodChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="store-builder-field store-builder-field--discount">
          <span>Discount</span>
          <div className="store-builder-discount-row">
            <div className="store-builder-discount-types" role="group" aria-label="Discount type">
              {DISCOUNT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`store-builder-discount-toggle ${discountType === option.value ? "is-active" : ""}`}
                  onClick={() => onDiscountTypeChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="0"
              max={discountType === "percent" ? "100" : undefined}
              step={discountType === "percent" ? "1" : "0.01"}
              value={discountValue}
              onChange={onDiscountValueChange}
              placeholder={discountType === "percent" ? "0" : "0.00"}
              className="store-builder-discount-input"
            />
          </div>
        </div>

        {paymentMethod === "cash" && (
          <div className="store-builder-cash-row">
            <label className="store-builder-field store-builder-field--cash">
              <span>Cash received</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cashReceived}
                onChange={onCashReceivedChange}
                placeholder="0.00"
              />
            </label>
            <div className="store-builder-field store-builder-field--cash-total">
              <span>Change</span>
              <strong>{formatMoney(changeDue, orderCurrency)}</strong>
            </div>
          </div>
        )}

        {paymentMethod === "momo" && (
          <label className="store-builder-field store-builder-field--cash">
            <span>MoMo reference</span>
            <input
              type="text"
              value={momoReference}
              onChange={onMomoReferenceChange}
              placeholder="Transaction ID or sender number"
            />
          </label>
        )}
      </div>

      <div className="store-builder-inline-totals store-builder-inline-totals--checkout" aria-label="Order totals">
        <div className="store-builder-inline-total">
          <span>Discount</span>
          <strong>-{formatMoney(discountAmount, orderCurrency)}</strong>
        </div>
      </div>

      <div className="store-builder-actions">
        <button
          type="button"
          className="store-builder-submit store-builder-submit--icon"
          onClick={() => submitSale({ payLater: false })}
          disabled={submitting || !canCompleteSale}
          aria-label={submitting ? "Selling" : "Sell"}
          title={submitting ? "Selling" : "Sell"}
        >
          <AppIcon icon={faMoneyBillWave} />
        </button>
        <button
          type="button"
          className="store-builder-submit store-builder-submit--danger store-builder-submit--icon"
          onClick={clearOrder}
          disabled={!orderItemsLength || submitting}
          aria-label="Cancel sale"
          title="Cancel sale"
        >
          <AppIcon icon={faXmark} />
        </button>
        <button
          type="button"
          className="store-builder-submit store-builder-submit--pending store-builder-submit--pay-later"
          onClick={() => submitSale({ payLater: true })}
          disabled={submitting || !canPayLater}
        >
          <AppIcon icon={faClock} /> {submitting ? "Saving..." : "Pay later"}
        </button>
      </div>

      <div className="store-builder-mobile-checkout">
        <div className="store-builder-mobile-total">
          <span>Total</span>
          <strong>{formatMoney(total, orderCurrency)}</strong>
        </div>
        <div className="store-builder-mobile-actions">
          <button
            type="button"
            className="store-builder-submit store-builder-submit--mobile"
            onClick={() => submitSale({ payLater: false })}
            disabled={submitting || !canCompleteSale}
          >
            <AppIcon icon={faMoneyBillWave} />
            {submitting ? "Selling..." : "Sell"}
          </button>
          <button
            type="button"
            className="store-builder-submit store-builder-submit--danger store-builder-submit--mobile"
            onClick={clearOrder}
            disabled={!orderItemsLength || submitting}
          >
            <AppIcon icon={faXmark} />
            Cancel
          </button>
          <button
            type="button"
            className="store-builder-submit store-builder-submit--pending store-builder-submit--mobile store-builder-submit--pay-later-mobile"
            onClick={() => submitSale({ payLater: true })}
            disabled={submitting || !canPayLater}
          >
            <AppIcon icon={faClock} />
            {submitting ? "Saving..." : "Pay later"}
          </button>
        </div>
      </div>
    </section>
  );
}

function StoreModeImageLightbox({ hoveredImage }) {
  if (!hoveredImage) return null;
  return (
    <div className="store-mode-image-lightbox" aria-hidden="true">
      <div className="store-mode-image-lightbox-frame">
        <img src={hoveredImage.src} alt={hoveredImage.name} />
        <span>{hoveredImage.name}</span>
      </div>
    </div>
  );
}

function StoreModeUserCard({ user }) {
  if (!user) return null;
  const displayName =
    user.name ||
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email ||
    "Staff";
  const displayEmail = user.personalEmail || user.email || "";
  const avatarSrc = String(user.imageUrl || user.profilePhoto || "").trim();
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("") || "??";

  return (
    <div className="store-mode-user-card">
      <div className="store-mode-user-avatar">
        {avatarSrc ? (
          <img src={avatarSrc} alt={displayName} />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <div className="store-mode-user-info">
        <strong>{displayName}</strong>
        {displayEmail && <span>{displayEmail}</span>}
      </div>
    </div>
  );
}

function StoreModeProductPreview({ hoveredImage }) {
  return (
    <div className="store-mode-product-preview">
      {hoveredImage ? (
        <>
          <div className="store-mode-product-preview-img">
            <img src={hoveredImage.src} alt={hoveredImage.name} />
          </div>
          <span className="store-mode-product-preview-name">{hoveredImage.name}</span>
        </>
      ) : (
        <span className="store-mode-product-preview-empty">Select an item to preview</span>
      )}
    </div>
  );
}

export function StoreModeLayout({
  onExit,
  onRefresh,
  loading,
  error,
  submitError,
  success,
  isOnline,
  draftStatus,
  inventoryProps,
  customerProps,
  orderProps,
  cartProps,
  hoveredImage,
  user,
}) {
  return (
    <div className="store-mode-page">
      <StoreModeHeader onExit={onExit} onRefresh={onRefresh} loading={loading} isOnline={isOnline} />
      <StoreModeFeedback
        loading={loading}
        error={error}
        submitError={submitError}
        success={success}
        isOnline={isOnline}
        draftStatus={draftStatus}
      />
      <div className="store-mode-left-col">
        <StoreModeInventoryPanel {...inventoryProps} />
        <StoreModeOrderPanel {...orderProps} />
      </div>
      <aside className="store-mode-builder-col" aria-label="Order builder">
        <StoreModeUserCard user={user} />
        <StoreModeCustomerPanel {...customerProps} />
        <StoreModeCartPanel {...cartProps} />
      </aside>
    </div>
  );
}
