import React from "react";
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
  formatMoney,
  getAvailableQuantity,
  getCategory,
  getCustomerLabel,
  getCustomerMeta,
  getQuantity,
  getUnitPrice,
} from "../storeModeShared";

const STOCK_FILTER_OPTIONS = [
  { id: "all", label: "All" },
  { id: "in", label: "In stock" },
  { id: "low", label: "Low" },
  { id: "out", label: "Out" },
];

const COMPACT_SEARCH_LAYOUT_WIDTH = 760;

function StoreModeHeader({ onExit, onRefresh, loading }) {
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
    </header>
  );
}

function StoreModeFeedback({ loading, error, submitError, success }) {
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
  orderQtyById,
  selectedProductId,
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
        <div className="store-mode-table-scroll">
          <table className="store-mode-table">
            <thead>
              <tr>
                <th className="store-mode-col store-mode-col--index table-row-index">#</th>
                <th className="store-mode-col store-mode-col--item">
                  <button
                    type="button"
                    className={sortHeaderClassName("item")}
                    onClick={() => requestSort("item")}
                    aria-pressed={sortKey === "item"}
                  >
                    Item <span className="sort-indicator">{sortIndicator("item")}</span>
                  </button>
                </th>
                {!isCompactSearchLayout ? (
                  <>
                    <th className="store-mode-col store-mode-col--sku">
                      <button
                        type="button"
                        className={sortHeaderClassName("sku")}
                        onClick={() => requestSort("sku")}
                        aria-pressed={sortKey === "sku"}
                      >
                        SKU <span className="sort-indicator">{sortIndicator("sku")}</span>
                      </button>
                    </th>
                    <th className="store-mode-col store-mode-col--category">
                      <button
                        type="button"
                        className={sortHeaderClassName("category")}
                        onClick={() => requestSort("category")}
                        aria-pressed={sortKey === "category"}
                      >
                        Category <span className="sort-indicator">{sortIndicator("category")}</span>
                      </button>
                    </th>
                    <th className="store-mode-col store-mode-col--price">
                      <button
                        type="button"
                        className={sortHeaderClassName("price")}
                        onClick={() => requestSort("price")}
                        aria-pressed={sortKey === "price"}
                      >
                        Price <span className="sort-indicator">{sortIndicator("price")}</span>
                      </button>
                    </th>
                  </>
                ) : null}
                <th className="store-mode-col store-mode-col--stock">
                  <button
                    type="button"
                    className={sortHeaderClassName("stock")}
                    onClick={() => requestSort("stock")}
                    aria-pressed={sortKey === "stock"}
                  >
                    Stock <span className="sort-indicator">{sortIndicator("stock")}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {!loading && visibleItems.length === 0 && emptyStateMessage && (
                <tr>
                  <td colSpan={isCompactSearchLayout ? 3 : 6} className="store-mode-empty">
                    {emptyStateMessage}
                  </td>
                </tr>
              )}
              {sortedVisibleItems.map((item, index) => {
                const productId = Number(item.id);
                const currentQty = orderQtyById.get(productId) || 0;
                const stock = getAvailableQuantity(item, currentQty);
                const isOut = stock <= 0;
                const isLow = !isOut && stock <= LOW_STOCK_THRESHOLD;
                const isSelected = selectedProductId === productId || currentQty > 0;
                const productName = item.name || "Untitled";
                const productImage = getCatalogItemImage(item);
                const productPrice = formatMoney(getUnitPrice(item), item.currency || "GHS");
                const productSku = item.sku || `ID ${item.id}`;
                const productCategory = getCategory(item);

                return (
                  <tr
                    key={item.id}
                    className={`${isOut ? "is-out" : isLow ? "is-low" : ""} ${isSelected ? "is-selected" : ""} ${!isOut ? "store-mode-row--clickable" : ""}`}
                    onClick={
                      !isOut
                        ? () => {
                            addToOrder(item);
                          }
                        : undefined
                    }
                    onKeyDown={
                      !isOut
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              addToOrder(item);
                            }
                          }
                        : undefined
                    }
                    tabIndex={!isOut ? 0 : undefined}
                    role={!isOut ? "button" : undefined}
                  >
                    <td className="store-mode-cell store-mode-cell--index table-row-index">
                      {index}
                    </td>
                    <td className="store-mode-cell store-mode-cell--item">
                      <div className="store-mode-product">
                        <button
                          type="button"
                          className="store-mode-product-image-trigger"
                          onMouseEnter={() => {
                            if (!isMobileViewport) showImagePreview(productImage, productName);
                          }}
                          onMouseLeave={() => {
                            if (!isMobileViewport) hideImagePreview();
                          }}
                          onFocus={() => {
                            if (!isMobileViewport) showImagePreview(productImage, productName);
                          }}
                          onBlur={() => {
                            if (!isMobileViewport) hideImagePreview();
                          }}
                          aria-label={`Preview ${productName}`}
                        >
                          <img
                            className="store-mode-product-image"
                            src={productImage}
                            alt={productName}
                            loading="lazy"
                          />
                        </button>
                        <div className="store-mode-product-copy">
                          <strong>{productName}</strong>
                          <span className="store-mode-product-price">{productPrice}</span>
                        </div>
                      </div>
                    </td>
                    {!isCompactSearchLayout ? (
                      <>
                        <td className="store-mode-cell store-mode-cell--sku" data-label="SKU">
                          {productSku}
                        </td>
                        <td className="store-mode-cell store-mode-cell--category" data-label="Category">
                          {productCategory}
                        </td>
                        <td className="store-mode-cell store-mode-cell--price" data-label="Price">
                          {productPrice}
                        </td>
                      </>
                    ) : null}
                    <td className="store-mode-cell store-mode-cell--stock" data-label="Stock">
                      <span className={`store-mode-stock-pill ${isOut ? "is-out" : isLow ? "is-low" : ""}`}>
                        {stock}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {sortedVisibleItems.length > 0 && (
              <tfoot className="admin-table-footer">
                {isCompactSearchLayout ? (
                  <tr>
                    <td className="admin-table-summary-cell is-count">
                      <span className="admin-table-summary-value">{inventoryTableSummary.count} items</span>
                    </td>
                    <td className="admin-table-summary-cell is-empty" />
                    <td className="admin-table-summary-cell">
                      <span className="admin-table-summary-value">{inventoryTableSummary.stock}</span>
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td className="admin-table-summary-cell is-count">
                      <span className="admin-table-summary-value">{inventoryTableSummary.count} items</span>
                    </td>
                    <td className="admin-table-summary-cell is-empty" />
                    <td className="admin-table-summary-cell is-empty" />
                    <td className="admin-table-summary-cell is-empty" />
                    <td className="admin-table-summary-cell">
                      <span className="admin-table-summary-value">
                        {formatMoney(
                          inventoryTableSummary.count
                            ? inventoryTableSummary.price / inventoryTableSummary.count
                            : 0
                        )}
                      </span>
                    </td>
                    <td className="admin-table-summary-cell">
                      <span className="admin-table-summary-value">{inventoryTableSummary.stock}</span>
                    </td>
                  </tr>
                )}
              </tfoot>
            )}
          </table>
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
                        const initial = String(label || "C").trim().charAt(0).toUpperCase() || "C";
                        return (
                          <button
                            key={customer.id}
                            type="button"
                            className={`store-builder-customer-option ${selectedCustomer?.id === customer.id ? "is-selected" : ""}`}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => onSelectCustomer(customer)}
                          >
                            <span className="store-builder-customer-option-mark" aria-hidden="true">
                              {initial}
                            </span>
                            <span className="store-builder-customer-option-copy">
                              <strong>{label}</strong>
                              <span>{getCustomerMeta(customer)}</span>
                            </span>
                            <span className="store-builder-customer-option-tag">Saved</span>
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
          <div className="store-builder-strip">
            {orderItems.map((item) => {
              const liveProduct = inventoryById.get(Number(item.productId));
              const maxStock = getQuantity(liveProduct || item);
              const productImage = getCatalogItemImage(liveProduct || item);
              const itemCurrency = item.currency || "GHS";
              const lineTotalLabel = formatMoney(item.unitPrice * item.quantity, itemCurrency);
              return (
                <div key={item.productId} className="store-builder-chip">
                  <div className="store-builder-chip-main">
                    <img
                      className="store-builder-chip-image"
                      src={productImage}
                      alt={item.name}
                      loading="lazy"
                    />
                    <div className="store-builder-chip-copy">
                      <strong>{item.name}</strong>
                      <div className="store-builder-chip-pricing">
                        <strong className="store-builder-chip-line-total">{lineTotalLabel}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="store-builder-chip-side">
                    <strong className="store-builder-chip-qty">{item.quantity}</strong>
                    <div className="store-builder-chip-actions">
                      <button
                        type="button"
                        className="store-mode-stepper-btn"
                        onClick={() => removeFromOrder(item.productId)}
                        disabled={submitting}
                      >
                        <AppIcon icon={faMinus} />
                      </button>

                      <button
                        type="button"
                        className="store-mode-stepper-btn"
                        onClick={() => liveProduct && addToOrder(liveProduct)}
                        disabled={submitting || !liveProduct || item.quantity >= maxStock}
                      >
                        <AppIcon icon={faPlus} />
                      </button>
                    </div>
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
  subtotal,
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
          <span>Total price</span>
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

export function StoreModeLayout({
  onExit,
  onRefresh,
  loading,
  error,
  submitError,
  success,
  inventoryProps,
  customerProps,
  orderProps,
  cartProps,
  hoveredImage,
}) {
  return (
    <div className="store-mode-page">
      <div className="store-mode-shell">
        <StoreModeHeader onExit={onExit} onRefresh={onRefresh} loading={loading} />
        <StoreModeFeedback
          loading={loading}
          error={error}
          submitError={submitError}
          success={success}
        />
        <StoreModeInventoryPanel {...inventoryProps} />
      </div>

      <aside className="store-builder-dock" aria-label="Order builder">
        <div className="store-builder-bar">
          <div className="store-builder-left">
            <StoreModeCustomerPanel {...customerProps} />
            <StoreModeOrderPanel {...orderProps} />
          </div>
          <StoreModeCartPanel {...cartProps} />
        </div>
      </aside>

      <StoreModeImageLightbox hoveredImage={hoveredImage} />
    </div>
  );
}
