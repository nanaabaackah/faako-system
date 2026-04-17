import React, { useEffect, useMemo, useState } from "react";
import { SelectField } from "@faako/ui";
import SearchField from "../../../components/SearchField/SearchField";
import TablePagination from "../../../components/TablePagination/TablePagination";
import { AppIcon } from "/src/components/Icon/Icon";
import { faBoxArchive } from "/src/icons/iconSet";

function InvoiceDocumentListSection({
  config,
  summaryCards,
  searchTerm,
  setSearchTerm,
  documentFilter,
  setDocumentFilter,
  paymentStatusFilter,
  setPaymentStatusFilter,
  documentTypeOptions,
  paymentStatusOptions,
  ordersLoading,
  bookingsLoading,
  documentsLoading,
  workspaceError,
  visibleEntries,
  selectedKey,
  handleSelectEntry,
  handleEntryKeyDown,
  getDocumentTableReference,
  formatShortDate,
  formatCurrency,
  archiveEntryFromList,
  archivingDocument,
  getDocumentArchiveLabel,
  DocumentPillComponent,
}) {
  const DocumentPill = DocumentPillComponent;
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(visibleEntries.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const paginatedEntries = useMemo(() => {
    const start = clampedPage * pageSize;
    return visibleEntries.slice(start, start + pageSize);
  }, [visibleEntries, clampedPage]);
  const pageSummary = useMemo(
    () => ({
      count: paginatedEntries.length,
      total: paginatedEntries.reduce((sum, entry) => sum + (Number(entry.total) || 0), 0),
    }),
    [paginatedEntries]
  );
  const renderPagination = (header = false, className = "") => (
    <TablePagination
      total={visibleEntries.length}
      pageIndex={clampedPage}
      pageSize={pageSize}
      pageCount={pageCount}
      onPrevious={() => setPage((p) => Math.max(0, p - 1))}
      onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
      header={header}
      className={className}
    />
  );

  useEffect(() => {
    setPage(0);
  }, [visibleEntries.length]);

  return (
    <>
      <section className="invoice-hub-kpis" aria-label="Invoice summary">
        <article className="bubble-card invoice-hub-kpi">
          <p>Open</p>
          <strong>{summaryCards.open}</strong>
          <span>Draft or unpaid</span>
        </article>
        <article className="bubble-card invoice-hub-kpi">
          <p>Paid</p>
          <strong>{summaryCards.paid}</strong>
          <span>Marked paid</span>
        </article>
        <article className="bubble-card invoice-hub-total-card">
          <p>Total value</p>
          <strong>{formatCurrency(summaryCards.total, config.currency)}</strong>
        </article>
      </section>

      <section className="invoice-hub-toolbar" aria-label="Invoice filters">
          <label className="invoice-hub-toolbar-filter">
            <span>Search</span>
            <SearchField
              className="invoice-hub-search"
              inputClassName="invoice-hub-search-input"
              clearClassName="invoice-hub-search-clear"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onClear={() => setSearchTerm("")}
              placeholder="Search invoice, receipt, customer or source"
            />
          </label>
        <div className="invoice-hub-toolbar-filters">
          <label className="invoice-hub-toolbar-filter">
            <span>Type</span>
            <SelectField value={documentFilter} onChange={(event) => setDocumentFilter(event.target.value)}>
              {documentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </label>

          <label className="invoice-hub-toolbar-filter">
            <span>Status</span>
            <SelectField
              value={paymentStatusFilter}
              onChange={(event) => setPaymentStatusFilter(event.target.value)}
            >
              {paymentStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </label>
        </div>
      </section>

      <section className="invoice-hub-table" aria-label="Invoices and receipts">
        {ordersLoading || bookingsLoading || documentsLoading ? (
          <p className="invoicing-muted">Loading documents...</p>
        ) : workspaceError && !visibleEntries.length ? (
          <p className="invoicing-error">{workspaceError}</p>
        ) : visibleEntries.length === 0 ? (
          <p className="invoicing-muted">No documents match this view.</p>
        ) : (
          <>
            <div className="admin-table admin-table-scroll invoice-hub-table-scroll">
              {renderPagination(true)}
              <table>
                <thead>
                  <tr>
                    <th className="table-row-index">#</th>
                    <th>Document</th>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Archive</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEntries.map((entry, index) => (
                    <tr
                      key={entry.key}
                      className={`invoice-hub-table-row ${selectedKey === entry.key ? "is-active" : ""}`}
                      tabIndex={0}
                      onClick={() => handleSelectEntry(entry.key)}
                      onKeyDown={(event) => handleEntryKeyDown(event, entry.key)}
                    >
                      <td className="table-row-index">{clampedPage * pageSize + index}</td>
                      <td>
                        <div className="admin-product invoice-hub-table-document">
                          <span className="admin-product-name">{getDocumentTableReference(entry)}</span>
                        </div>
                      </td>
                      <td>{entry.customerName || "-"}</td>
                      <td>
                        <span className="invoice-hub-table-type">
                          {entry.documentType === "receipt" ? "Receipt" : "Invoice"}
                        </span>
                      </td>
                      <td>{entry.linkedLabel}</td>
                      <td>{formatShortDate(entry.issueDate)}</td>
                      <td><DocumentPill value={entry.paymentStatus} /></td>
                      <td>{formatCurrency(entry.total, config.currency)}</td>
                      <td>
                        <button
                          type="button"
                          className="invoice-hub-table-action invoice-hub-table-action-danger"
                          onClick={(event) => archiveEntryFromList(entry, event)}
                          onKeyDown={(event) => event.stopPropagation()}
                          disabled={archivingDocument}
                          aria-label={`Archive ${getDocumentArchiveLabel(entry)}`}
                          title={`Archive ${getDocumentArchiveLabel(entry)}`}
                        >
                          <AppIcon icon={faBoxArchive} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {visibleEntries.length > 0 && (
                  <tfoot className="admin-table-footer">
                    <tr>
                      <td className="admin-table-summary-cell is-count">
                        <span className="admin-table-summary-value">{pageSummary.count}</span>
                      </td>
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell">
                        <span className="admin-table-summary-value">
                          {formatCurrency(pageSummary.total, config.currency)}
                        </span>
                      </td>
                      <td className="admin-table-summary-cell is-empty" />
                    </tr>
                  </tfoot>
                )}
              </table>
              {renderPagination(false, "invoice-hub-table-pagination")}
            </div>

            <div className="invoice-hub-mobile-list" role="list" aria-label="Invoices and receipts">
              {paginatedEntries.map((entry, index) => (
                <article
                  key={`${entry.key}-mobile`}
                  role="button"
                  tabIndex={0}
                  className={`invoice-hub-list-item invoice-hub-mobile-card${
                    selectedKey === entry.key ? " is-active" : ""
                  }`}
                  onClick={() => handleSelectEntry(entry.key)}
                  onKeyDown={(event) => handleEntryKeyDown(event, entry.key)}
                >
                  <div className="invoice-hub-mobile-card-head">
                    <div className="invoice-hub-mobile-card-copy">
                      <span className="invoice-hub-mobile-card-index">#{clampedPage * pageSize + index}</span>
                      <strong>{getDocumentTableReference(entry)}</strong>
                      <p>{entry.customerName || "Customer"}</p>
                    </div>
                    <div className="invoice-hub-mobile-card-aside">
                      <strong className="invoice-hub-mobile-card-total">
                        {formatCurrency(entry.total, config.currency)}
                      </strong>
                      <button
                        type="button"
                        className="invoice-hub-table-action invoice-hub-table-action-danger"
                        onClick={(event) => archiveEntryFromList(entry, event)}
                        onKeyDown={(event) => event.stopPropagation()}
                        disabled={archivingDocument}
                        aria-label={`Archive ${getDocumentArchiveLabel(entry)}`}
                        title={`Archive ${getDocumentArchiveLabel(entry)}`}
                      >
                        <AppIcon icon={faBoxArchive} />
                      </button>
                    </div>
                  </div>

                  <div className="invoice-hub-mobile-card-meta">
                    <span className="invoice-hub-table-type">
                      {entry.documentType === "receipt" ? "Receipt" : "Invoice"}
                    </span>
                    <span>{formatShortDate(entry.issueDate)}</span>
                  </div>

                  <div className="invoice-hub-mobile-card-foot">
                    <span className="invoice-hub-mobile-card-source">{entry.linkedLabel}</span>
                    <DocumentPill value={entry.paymentStatus} />
                  </div>
                </article>
              ))}
            </div>
            {renderPagination(false, "invoice-hub-mobile-pagination")}
          </>
        )}
      </section>
    </>
  );
}

export default React.memo(InvoiceDocumentListSection);
