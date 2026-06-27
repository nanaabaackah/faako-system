import React from "react";
import {
  HiOutlineArchive,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineCheckCircle,
  HiOutlineDotsVertical,
  HiOutlinePencilAlt,
  HiOutlineTrash,
} from "react-icons/hi";
import { ERPStatusBadge } from "@faako/ui";
import {
  formatInventoryStatusLabel,
  getInventoryComputedStatus,
  getInventoryProductName,
  getInventoryProductSku,
  getInventoryStatusTone,
  getInventoryVariantLabel,
  resolveInventoryAvailableQuantity,
} from "../../utils/inventoryUtils";
import type { AdminProduct, InventoryItem } from "../../types/inventory";

type PublishingStatus = AdminProduct["publishingStatus"];

interface InventoryPaginationProps {
  total: number;
  pageStart: number;
  pageEnd: number;
  pageIndex: number;
  pageCount: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  header?: boolean;
}

interface InventoryStockTableProps {
  loading: boolean;
  error: string;
  filteredInventory: InventoryItem[];
  paginatedInventory: InventoryItem[];
  selectedItemId: string;
  selectedItemIds: Set<string>;
  openActionsId: string;
  canManageInventory: boolean;
  savingProduct: boolean;
  pageStart: number;
  pageEnd: number;
  pageIndex: number;
  pageCount: number;
  paginatedStockValue: number;
  resolveItemProduct: (item: InventoryItem) => AdminProduct | null;
  getItemCategoryLabel: (item: InventoryItem) => string;
  getItemStockValue: (item: InventoryItem) => number | null;
  formatMoney: (value: number, currency?: string) => string;
  toMoneyNumber: (value: unknown) => number | null;
  onOpenItemDetail: (itemId: string) => void;
  onToggleSelected: (itemId: string) => void;
  onTogglePageSelected: () => void;
  onToggleActions: (itemId: string) => void;
  onSavePublishingStatus: (
    item: InventoryItem,
    publishingStatus: PublishingStatus,
    options?: { confirm?: boolean; label?: string }
  ) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

const InventoryPagination: React.FC<InventoryPaginationProps> = ({
  total,
  pageStart,
  pageEnd,
  pageIndex,
  pageCount,
  onPreviousPage,
  onNextPage,
  header = false,
}) => (
  <div
    className={[
      "stroane-inventory__pagination",
      "inventory-register-pagination",
      header ? "inventory-register-pagination-header" : "",
    ]
      .filter(Boolean)
      .join(" ")}
  >
    <div className="inventory-register-pagination-copy">
      <strong className="inventory-register-pagination-range">
        Showing {pageStart}-{pageEnd} of {total}
      </strong>
    </div>
    <div className="inventory-register-pagination-meta">
      <div className="table-pagination-controls inventory-register-pagination-controls">
        <button
          type="button"
          onClick={onPreviousPage}
          disabled={pageIndex === 0}
          aria-label="Previous inventory page"
        >
          <HiOutlineChevronLeft aria-hidden="true" />
        </button>
        <span className="inventory-register-pagination-page">
          Page {total ? pageIndex + 1 : 0} of {total ? pageCount : 0}
        </span>
        <button
          type="button"
          onClick={onNextPage}
          disabled={pageIndex >= pageCount - 1 || !total}
          aria-label="Next inventory page"
        >
          <HiOutlineChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
);

const InventoryStockTable: React.FC<InventoryStockTableProps> = ({
  loading,
  error,
  filteredInventory,
  paginatedInventory,
  selectedItemId,
  selectedItemIds,
  openActionsId,
  canManageInventory,
  savingProduct,
  pageStart,
  pageEnd,
  pageIndex,
  pageCount,
  paginatedStockValue,
  resolveItemProduct,
  getItemCategoryLabel,
  getItemStockValue,
  formatMoney,
  toMoneyNumber,
  onOpenItemDetail,
  onToggleSelected,
  onTogglePageSelected,
  onToggleActions,
  onSavePublishingStatus,
  onPreviousPage,
  onNextPage,
}) => (
  <div className="stroane-inventory__admin-table admin-table admin-table-scroll">
    <InventoryPagination
      total={filteredInventory.length}
      pageStart={pageStart}
      pageEnd={pageEnd}
      pageIndex={pageIndex}
      pageCount={pageCount}
      onPreviousPage={onPreviousPage}
      onNextPage={onNextPage}
      header
    />
    <table className="stroane-inventory__table">
      <colgroup>
        <col className="stroane-inventory__col-select" />
        <col className="stroane-inventory__col-number" />
        <col className="stroane-inventory__col-product" />
        <col className="col-desktop stroane-inventory__col-sku" />
        <col className="stroane-inventory__col-variant" />
        <col className="stroane-inventory__col-category" />
        <col className="stroane-inventory__col-price" />
        <col className="stroane-inventory__col-stock" />
        <col className="stroane-inventory__col-value" />
        <col className="stroane-inventory__col-supplier" />
        <col className="stroane-inventory__col-status" />
        <col className="stroane-inventory__col-actions" />
      </colgroup>
      <thead>
        <tr>
          <th className="portal-table-select-cell" aria-label="Select rows">
            <input
              type="checkbox"
              className="portal-table-checkbox"
              checked={
                paginatedInventory.length > 0 &&
                paginatedInventory.every((item) => selectedItemIds.has(item.id))
              }
              onChange={onTogglePageSelected}
              disabled={!paginatedInventory.length}
              aria-label="Select all rows on this page"
            />
          </th>
          <th className="portal-table-number-cell">#</th>
          <th>Product</th>
          <th className="col-desktop">SKU</th>
          <th className="col-desktop">Variant</th>
          <th className="col-desktop">Category</th>
          <th className="col-desktop">Price</th>
          <th className="col-desktop">Quantity</th>
          <th className="col-desktop">Stock value</th>
          <th className="col-desktop">Supplier</th>
          <th className="col-desktop">Status</th>
          <th aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={12} className="stroane-inventory__table-empty">
              Loading inventory...
            </td>
          </tr>
        ) : null}
        {!loading && error && !filteredInventory.length ? (
          <tr>
            <td colSpan={12} className="stroane-inventory__table-empty is-error">
              {error || "Unable to load inventory."}
            </td>
          </tr>
        ) : null}
        {!loading && !error && !filteredInventory.length ? (
          <tr>
            <td colSpan={12} className="stroane-inventory__table-empty">
              No products match the current filters.
            </td>
          </tr>
        ) : null}
        {!loading
          ? paginatedInventory.map((item, index) => {
              const product = resolveItemProduct(item);
              const status = getInventoryComputedStatus(item);
              const available = resolveInventoryAvailableQuantity(item);
              const price = toMoneyNumber(item.product?.price ?? product?.price);
              const currency = item.product?.currency || product?.currency || "GHS";
              const stockValue = getItemStockValue(item);
              const productId = product?.id || item.product?.id || item.productId || "";
              const publishingStatus = product?.publishingStatus || "draft";

              return (
                <tr
                  key={item.id}
                  className={[
                    item.id === selectedItemId ? "is-selected" : "",
                    selectedItemIds.has(item.id) ? "is-bulk-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => onOpenItemDetail(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenItemDetail(item.id);
                    }
                  }}
                  tabIndex={0}
                >
                  <td
                    className="portal-table-select-cell"
                    data-label="Select"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="portal-table-checkbox"
                      checked={selectedItemIds.has(item.id)}
                      onChange={() => onToggleSelected(item.id)}
                      aria-label={`Select ${getInventoryProductName(item)}`}
                    />
                  </td>
                  <td className="portal-table-number-cell" data-label="#">
                    {pageStart + index}
                  </td>
                  <td data-label="Product">
                    <span className="stroane-inventory__product-cell">
                      <strong>{getInventoryProductName(item)}</strong>
                    </span>
                  </td>
                  <td className="col-desktop" data-label="SKU">{getInventoryProductSku(item)}</td>
                  <td className="col-desktop" data-label="Variant">{item.variantId ? getInventoryVariantLabel(item) : "—"}</td>
                  <td className="col-desktop" data-label="Category">{getItemCategoryLabel(item)}</td>
                  <td className="col-desktop" data-label="Price">
                    {price === null ? "Not set" : formatMoney(price, currency)}
                  </td>
                  <td className="col-desktop" data-label="Stock">
                    <span className="stroane-inventory__quantity-cell">
                      <strong>{available === null ? "Not set" : available}</strong>
                    </span>
                  </td>
                  <td className="col-desktop" data-label="Stock value">
                    {stockValue === null ? "Not set" : formatMoney(stockValue, currency)}
                  </td>
                  <td className="col-desktop" data-label="Supplier">{item.supplier?.name || "Unassigned"}</td>
                  <td className="col-desktop" data-label="Status">
                    <ERPStatusBadge tone={getInventoryStatusTone(status)}>
                      {formatInventoryStatusLabel(status)}
                    </ERPStatusBadge>
                  </td>
                  <td
                    className="stroane-inventory__actions-cell"
                    data-label="Actions"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="stroane-inventory__menu-button"
                      aria-label={`Open actions for ${getInventoryProductName(item)}`}
                      aria-expanded={openActionsId === item.id}
                      onClick={() => onToggleActions(item.id)}
                    >
                      <HiOutlineDotsVertical aria-hidden="true" />
                    </button>
                    {openActionsId === item.id ? (
                      <div className="stroane-inventory__row-menu" role="menu">
                        <button type="button" onClick={() => onOpenItemDetail(item.id)}>
                          <HiOutlinePencilAlt aria-hidden="true" />
                          <span>Manage</span>
                        </button>
                        {publishingStatus === "archived" ? (
                          <button
                            type="button"
                            onClick={() => onSavePublishingStatus(item, "active")}
                            disabled={!canManageInventory || savingProduct || !productId}
                          >
                            <HiOutlineCheckCircle aria-hidden="true" />
                            <span>Make active</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSavePublishingStatus(item, "archived")}
                            disabled={!canManageInventory || savingProduct || !productId}
                          >
                            <HiOutlineArchive aria-hidden="true" />
                            <span>Archive</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="is-danger"
                          onClick={() =>
                            onSavePublishingStatus(item, "archived", {
                              confirm: true,
                              label: "Remove listing",
                            })
                          }
                          disabled={!canManageInventory || savingProduct || !productId}
                        >
                          <HiOutlineTrash aria-hidden="true" />
                          <span>Delete listing</span>
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })
          : null}
      </tbody>
      {filteredInventory.length ? (
        <tfoot className="admin-table-footer">
          <tr>
            <td className="admin-table-summary-cell is-empty" />
            <td className="admin-table-summary-cell is-empty" />
            <td className="admin-table-summary-cell is-empty" />
            <td className="admin-table-summary-cell is-empty" />
            <td className="admin-table-summary-cell is-empty" />
            <td className="admin-table-summary-cell is-empty" />
            <td className="admin-table-summary-cell is-empty" />
            <td className="admin-table-summary-cell is-empty" />
            <td className="admin-table-summary-cell">
              <span className="admin-table-summary-value">
                {formatMoney(paginatedStockValue)}
              </span>
            </td>
            <td className="admin-table-summary-cell is-empty" />
            <td className="admin-table-summary-cell is-empty" />
            <td className="admin-table-summary-cell is-empty" />
          </tr>
        </tfoot>
      ) : null}
    </table>
    <InventoryPagination
      total={filteredInventory.length}
      pageStart={pageStart}
      pageEnd={pageEnd}
      pageIndex={pageIndex}
      pageCount={pageCount}
      onPreviousPage={onPreviousPage}
      onNextPage={onNextPage}
    />
  </div>
);

export default InventoryStockTable;
