/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./AdminDocuments.css";
import { Link } from "react-router-dom";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faCloudArrowUp,
  faDownload,
  faEye,
  faFolderOpen,
  faSearch,
} from "/src/icons/iconSet";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import SearchField from "../../components/SearchField/SearchField";

const COMPANY = {
  name: "REEBS Party Themes",
  location: "Sakumono Broadway, Tema, Ghana",
  phone: "+233 24 423 8419",
  email: "info@reebs.com",
  logo: "/imgs/brand/reebs_logo.png",
};

const formatCurrency = (amount) => {
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch {
    return `GHS ${Number(amount || 0).toFixed(2)}`;
  }
};

const formatPdfCurrency = (amount) => {
  const value = Number(amount || 0);
  try {
    const formatted = new Intl.NumberFormat("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return `GHS ${formatted}`;
  } catch {
    return `GHS ${value.toFixed(2)}`;
  }
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const formatDateStamp = (value) => {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10).replace(/-/g, "");
};

const loadImageData = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load logo");
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const normalizeOrderDoc = (payload) => {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return {
    type: "order",
    label: "Receipt",
    invoiceNumber: payload?.invoiceNumber || "",
    date: payload?.date || formatDate(new Date()),
    customer: payload?.customer || {},
    items: items.map((item) => ({
      name: item.name || "Item",
      quantity: item.quantity || 0,
      unitPrice: (() => {
        const raw = item.unitPrice ?? item.unitPriceCents ?? item.unit_price ?? 0;
        const cents =
          item.unitPriceCents != null || item.unit_price != null || item.totalCents != null || item.total_amount != null;
        return cents ? Number(raw || 0) / 100 : Number(raw || 0);
      })(),
      total: (() => {
        const raw = item.total ?? item.totalCents ?? item.total_amount ?? 0;
        const cents =
          item.unitPriceCents != null || item.unit_price != null || item.totalCents != null || item.total_amount != null;
        return cents ? Number(raw || 0) / 100 : Number(raw || 0);
      })(),
    })),
    summary: payload?.summary || { subtotal: 0, taxRate: 0, taxTotal: 0, grandTotal: 0 },
    expenses: payload?.expenses || [],
  };
};

const normalizeBookingDoc = (payload) => {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const total = Number(payload?.totalAmount || 0) / 100;
  return {
    type: "booking",
    label: "Invoice",
    invoiceNumber: `INV-${formatDateStamp(payload?.eventDate)}-${payload?.id}`,
    date: formatDate(payload?.eventDate),
    customer: {
      name: payload?.customerName || "Customer",
      email: payload?.customerEmail || "",
      phone: payload?.customerPhone || "",
    },
    event: {
      eventDate: payload?.eventDate,
      startTime: payload?.startTime || "",
      endTime: payload?.endTime || "",
      venueAddress: payload?.venueAddress || "",
    },
    items: items.map((item) => ({
      name: item.productName || "Item",
      quantity: item.quantity || 0,
      unitPrice: Number(item.price || 0) / 100,
      total: (Number(item.price || 0) / 100) * (item.quantity || 0),
    })),
    summary: {
      subtotal: total,
      taxRate: 0,
      taxTotal: 0,
      grandTotal: total,
    },
    expenses: payload?.expenses || [],
  };
};

function AdminDocuments() {
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadForm, setUploadForm] = useState({ title: "", category: "Other", file: null });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [downloading, setDownloading] = useState("");
  const logoRef = useRef(null);

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  useEffect(() => {
    loadImageData(COMPANY.logo)
      .then((data) => {
        logoRef.current = data;
      })
      .catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [ordersRes, bookingsRes, uploadsRes] = await Promise.all([
        fetch("/.netlify/functions/orders"),
        fetch("/.netlify/functions/bookings"),
        fetch("/.netlify/functions/documents"),
      ]);
      const [ordersData, bookingsData, uploadsData] = await Promise.all([
        ordersRes.json(),
        bookingsRes.json(),
        uploadsRes.json(),
      ]);
      if (!ordersRes.ok) throw new Error(ordersData?.error || "Failed to load orders.");
      if (!bookingsRes.ok) throw new Error(bookingsData?.error || "Failed to load bookings.");
      if (!uploadsRes.ok) throw new Error(uploadsData?.error || "Failed to load documents.");
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      setUploads(Array.isArray(uploadsData) ? uploadsData : []);
    } catch (err) {
      console.error("Documents fetch failed", err);
      setError(err.message || "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const generatedDocs = useMemo(() => {
    const receipts = orders.map((order) => ({
      id: `order-${order.id}`,
      source: "generated",
      docType: "receipt",
      label: "Receipt",
      title: order.orderNumber || `Order #${order.id}`,
      subtitle: order.customerName || "Walk-in customer",
      date: order.orderDate,
      amount: order.total || 0,
      referenceId: order.id,
      referenceType: "orders",
    }));
    const invoices = bookings.map((booking) => ({
      id: `booking-${booking.id}`,
      source: "generated",
      docType: "invoice",
      label: "Invoice",
      title: `Booking #${booking.id}`,
      subtitle: booking.customerName || "Customer",
      date: booking.eventDate,
      amount: Number(booking.totalAmount || 0) / 100,
      referenceId: booking.id,
      referenceType: "bookings",
    }));
    return [...receipts, ...invoices];
  }, [orders, bookings]);

  const uploadedDocs = useMemo(
    () =>
      uploads.map((doc) => {
        const category = String(doc.category || "").toLowerCase();
        const isGenerated = doc.source === "generated";
        const docType = category.includes("invoice")
          ? "invoice"
          : category.includes("receipt")
            ? "receipt"
            : "upload";
        return {
          id: `upload-${doc.id}`,
          source: isGenerated ? "generated" : "upload",
          docType: isGenerated ? docType : "upload",
          label: doc.category || "Document",
          title: doc.title || doc.fileName,
          subtitle: doc.fileName,
          date: doc.createdAt,
          amount: null,
          referenceId: doc.id,
          referenceType: "upload",
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          size: doc.size,
        };
      }),
    [uploads]
  );

  const allDocs = useMemo(() => [...generatedDocs, ...uploadedDocs], [generatedDocs, uploadedDocs]);

  const filteredDocs = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return allDocs.filter((doc) => {
      if (activeTab === "receipts" && doc.docType !== "receipt") return false;
      if (activeTab === "invoices" && doc.docType !== "invoice") return false;
      if (activeTab === "uploads" && doc.source !== "upload") return false;
      if (!needle) return true;
      return (
        String(doc.title || "").toLowerCase().includes(needle) ||
        String(doc.subtitle || "").toLowerCase().includes(needle) ||
        String(doc.label || "").toLowerCase().includes(needle)
      );
    });
  }, [allDocs, activeTab, searchTerm]);

  const documentsStats = useMemo(() => {
    const datedDocs = allDocs
      .filter((doc) => doc?.date)
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      receiptCount: allDocs.filter((doc) => doc.docType === "receipt").length,
      invoiceCount: allDocs.filter((doc) => doc.docType === "invoice").length,
      visibleCount: filteredDocs.length,
      latestLabel: datedDocs[0]?.date ? formatDate(datedDocs[0].date) : "No activity",
    };
  }, [allDocs, filteredDocs]);

  const downloadUpload = async (doc) => {
    if (!doc?.referenceId) return;
    setDownloading(doc.id);
    try {
      const res = await fetch(`/.netlify/functions/documents?id=${doc.referenceId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch document");
      const mime = data.mimeType || "application/octet-stream";
      const blob = await fetch(`data:${mime};base64,${data.data}`).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.fileName || data.title || "document";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed", err);
    } finally {
      setDownloading("");
    }
  };

  const buildPdf = (docData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let cursorY = margin;

    if (logoRef.current) {
      doc.addImage(logoRef.current, "PNG", margin, margin, 20, 20);
      doc.setFontSize(18);
      doc.text(COMPANY.name, margin + 26, margin + 8);
      doc.setFontSize(10);
      doc.text(COMPANY.location, margin + 26, margin + 14);
      doc.text(`${COMPANY.phone} • ${COMPANY.email}`, margin + 26, margin + 19);
      cursorY = margin + 28;
    } else {
      doc.setFontSize(18);
      doc.text(COMPANY.name, margin, margin + 6);
      doc.setFontSize(10);
      doc.text(COMPANY.location, margin, margin + 12);
      doc.text(`${COMPANY.phone} • ${COMPANY.email}`, margin, margin + 17);
      cursorY = margin + 24;
    }

    doc.setFontSize(14);
    doc.text(docData.label.toUpperCase(), pageWidth - margin, margin + 6, { align: "right" });
    doc.setFontSize(10);
    doc.text(`#${docData.invoiceNumber || "N/A"}`, pageWidth - margin, margin + 12, { align: "right" });
    doc.text(`Date: ${docData.date || "-"}`, pageWidth - margin, margin + 18, { align: "right" });

    doc.setFontSize(11);
    doc.text("Bill to:", margin, cursorY);
    doc.setFontSize(10);
    doc.text(docData.customer?.name || "Customer", margin, cursorY + 6);
    if (docData.customer?.phone) {
      doc.text(docData.customer.phone, margin, cursorY + 12);
    }
    if (docData.customer?.email) {
      doc.text(docData.customer.email, margin, cursorY + 18);
    }
    cursorY += docData.customer?.email ? 24 : 18;

    if (docData.event) {
      doc.setFontSize(10);
      doc.text(
        `Event: ${formatDate(docData.event.eventDate)} · ${docData.event.startTime || ""} ${docData.event.endTime || ""}`.trim(),
        margin,
        cursorY + 2
      );
      if (docData.event.venueAddress) {
        doc.text(docData.event.venueAddress, margin, cursorY + 8);
      }
      cursorY += docData.event.venueAddress ? 14 : 8;
    }

    const tableBody = (docData.items || []).map((item) => [
      item.name,
      item.quantity,
      formatPdfCurrency(item.unitPrice || 0),
      formatPdfCurrency(item.total || 0),
    ]);

    const tableConfig = {
      startY: cursorY + 8,
      head: [["Description", "Qty", "Unit Price", "Total"]],
      body: tableBody,
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [118, 50, 7], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
    };

    if (typeof doc.autoTable === "function") {
      doc.autoTable(tableConfig);
    } else if (typeof autoTable === "function") {
      autoTable(doc, tableConfig);
    }

    const finalY = doc.lastAutoTable?.finalY || tableConfig.startY + 20;
    const totalsX = pageWidth - margin - 70;
    const totalsY = finalY + 8;

    doc.setFillColor(245, 245, 245);
    doc.rect(totalsX, totalsY - 4, 70, docData.type === "booking" ? 34 : 24, "F");
    doc.setFontSize(10);
    doc.text("Subtotal:", totalsX + 4, totalsY + 4);
    doc.text(formatPdfCurrency(docData.summary?.subtotal || 0), pageWidth - margin, totalsY + 4, { align: "right" });
    if ((docData.summary?.taxRate || 0) > 0) {
      doc.text(`VAT (${Math.round(docData.summary.taxRate * 100)}%):`, totalsX + 4, totalsY + 10);
      doc.text(formatPdfCurrency(docData.summary.taxTotal || 0), pageWidth - margin, totalsY + 10, { align: "right" });
    }
    doc.setFontSize(11);
    doc.text("Total:", totalsX + 4, totalsY + 18);
    doc.text(formatPdfCurrency(docData.summary?.grandTotal || 0), pageWidth - margin, totalsY + 18, { align: "right" });

    if (docData.type === "booking") {
      const totalDue = Number(docData.summary?.grandTotal || 0);
      const deposit = Number((totalDue * 0.7).toFixed(2));
      const balance = Number((totalDue - deposit).toFixed(2));
      doc.setFontSize(10);
      doc.text("Deposit:", totalsX + 4, totalsY + 24);
      doc.text(formatPdfCurrency(deposit), pageWidth - margin, totalsY + 24, { align: "right" });
      doc.text("Balance Due:", totalsX + 4, totalsY + 30);
      doc.text(formatPdfCurrency(balance), pageWidth - margin, totalsY + 30, { align: "right" });
    }

    if (docData.expenses && docData.expenses.length > 0) {
      const expenseRows = docData.expenses.map((expense) => [
        expense.category,
        formatDate(expense.date),
        formatPdfCurrency(expense.amount),
        expense.description || "-",
      ]);
      const expensesY = totalsY + (docData.type === "booking" ? 40 : 30);
      const expensesConfig = {
        startY: expensesY,
        head: [["Related expenses", "Date", "Amount", "Notes"]],
        body: expenseRows,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [31, 37, 48], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      };
      if (typeof doc.autoTable === "function") {
        doc.autoTable(expensesConfig);
      } else if (typeof autoTable === "function") {
        autoTable(doc, expensesConfig);
      }
    }

    return doc;
  };

  const downloadGenerated = async (doc) => {
    setDownloading(doc.id);
    try {
      if (doc.referenceType === "orders") {
        const res = await fetch(`/.netlify/functions/generateInvoice?orderId=${doc.referenceId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load receipt");
        const normalized = normalizeOrderDoc(data);
        const pdf = buildPdf(normalized);
        pdf.save(`receipt-${normalized.invoiceNumber || doc.referenceId}.pdf`);
      } else {
        const res = await fetch(`/.netlify/functions/getInvoiceDetails?id=${doc.referenceId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load invoice");
        const normalized = normalizeBookingDoc(data);
        const pdf = buildPdf(normalized);
        pdf.save(`invoice-${normalized.invoiceNumber || doc.referenceId}.pdf`);
      }
    } catch (err) {
      console.error("Generated download failed", err);
    } finally {
      setDownloading("");
    }
  };

  const previewUpload = async (doc) => {
    if (!doc?.referenceId) return;
    setDownloading(doc.id);
    try {
      const res = await fetch(`/.netlify/functions/documents?id=${doc.referenceId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch document");
      const mime = data.mimeType || "application/octet-stream";
      const blob = await fetch(`data:${mime};base64,${data.data}`).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("Preview failed", err);
    } finally {
      setDownloading("");
    }
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    setUploadError("");
    if (!uploadForm.file) {
      setUploadError("Select a file to upload.");
      return;
    }

    setUploading(true);
    try {
      const file = uploadForm.file;
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsDataURL(file);
      });
      const base64 = String(dataUrl || "").split(",")[1] || "";
      if (!base64) throw new Error("Unable to encode file.");

      const res = await fetch("/.netlify/functions/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: uploadForm.title || file.name,
          category: uploadForm.category,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          data: base64,
          source: "upload",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Upload failed.");
      setUploads((prev) => [data, ...prev]);
      setUploadForm({ title: "", category: "Other", file: null });
    } catch (err) {
      console.error("Upload failed", err);
      setUploadError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="documents-page documents-page--redesign">
      <div className="documents-shell">
        <AdminBreadcrumb items={[{ label: "Documents" }]} />

        <header className="documents-header">
          <div>
            <p className="documents-eyebrow">Document Hub</p>
            <h1>Documents</h1>
            <p className="documents-subtitle">
              Track generated receipts, rental invoices, and any uploaded operational files in one place.
            </p>
          </div>
          <div className="documents-summary">
            <div>
              <span>Generated</span>
              <strong>{generatedDocs.length}</strong>
            </div>
            <div>
              <span>Uploads</span>
              <strong>{uploads.length}</strong>
            </div>
            <div>
              <span>In view</span>
              <strong>{documentsStats.visibleCount}</strong>
            </div>
            <div>
              <span>Last activity</span>
              <strong>{documentsStats.latestLabel}</strong>
            </div>
          </div>
        </header>

        <section className="documents-toolbar">
          <div className="documents-tabs" role="tablist" aria-label="Document filter">
            <button type="button" className={activeTab === "all" ? "is-active" : ""} onClick={() => setActiveTab("all")}>
              All documents
            </button>
            <button type="button" className={activeTab === "receipts" ? "is-active" : ""} onClick={() => setActiveTab("receipts")}>
              Receipts
            </button>
            <button type="button" className={activeTab === "invoices" ? "is-active" : ""} onClick={() => setActiveTab("invoices")}>
              Invoices
            </button>
            <button type="button" className={activeTab === "uploads" ? "is-active" : ""} onClick={() => setActiveTab("uploads")}>
              Uploads
            </button>
          </div>
          <SearchField
            className="documents-search"
            placeholder="Search by customer, reference, or file..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onClear={() => setSearchTerm("")}
            aria-label="Search documents"
          />
          <p className="documents-toolbar-note">
            {documentsStats.receiptCount} receipts and {documentsStats.invoiceCount} invoices are available alongside
            uploaded contracts and proofs.
          </p>
        </section>

        <div className="documents-layout">
          <section className="documents-list-panel">
            <div className="documents-panel-head">
              <div>
                <p className="documents-card-label">Library</p>
                <h3>Active document stream</h3>
              </div>
              <span>{documentsStats.visibleCount} showing</span>
            </div>
            {loading ? (
              <p className="documents-muted">Loading documents...</p>
            ) : error ? (
              <p className="documents-error">{error}</p>
            ) : filteredDocs.length === 0 ? (
              <p className="documents-muted">No documents match this filter.</p>
            ) : (
              <div className="documents-list">
                {filteredDocs.map((doc) => (
                  <article key={doc.id} className="documents-card">
                    <div className="documents-card-top">
                      <div>
                        <p className="documents-card-type">{doc.label}</p>
                        <h3>{doc.title}</h3>
                        <p className="documents-card-sub">{doc.subtitle}</p>
                      </div>
                      <span className={`documents-tag ${doc.docType}`}>{doc.docType}</span>
                    </div>
                    <div className="documents-meta">
                      <span>{formatDate(doc.date)}</span>
                      {doc.amount !== null && doc.amount !== undefined ? <span>{formatCurrency(doc.amount)}</span> : null}
                    </div>
                    <div className="documents-actions">
                      {doc.source === "generated" && doc.referenceType !== "upload" ? (
                        <Link
                          to={`/admin/invoicing?type=${doc.referenceType}&id=${doc.referenceId}`}
                          className="documents-secondary"
                        >
                          <AppIcon icon={faEye} /> Preview
                        </Link>
                      ) : (
                        <button type="button" className="documents-secondary" onClick={() => previewUpload(doc)}>
                          <AppIcon icon={faEye} /> Preview
                        </button>
                      )}
                      <button
                        type="button"
                        className="documents-primary"
                        onClick={() => (doc.source === "generated" && doc.referenceType !== "upload" ? downloadGenerated(doc) : downloadUpload(doc))}
                        disabled={downloading === doc.id}
                      >
                        <AppIcon icon={faDownload} />
                        {downloading === doc.id ? "Preparing..." : "Download"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="documents-upload">
            <div className="documents-upload-card">
              <div className="documents-upload-head">
                <AppIcon icon={faFolderOpen} />
                <div>
                  <h3>Upload documents</h3>
                  <p>Store contracts, vendor agreements, or signed receipts.</p>
                </div>
              </div>
              <form className="documents-form" onSubmit={handleUpload}>
                <label>
                  Document title
                  <input
                    type="text"
                    value={uploadForm.title}
                    onChange={(event) => setUploadForm({ ...uploadForm, title: event.target.value })}
                    placeholder="e.g. Supplier agreement"
                  />
                </label>
                <label>
                  Category
                  <select
                    value={uploadForm.category}
                    onChange={(event) => setUploadForm({ ...uploadForm, category: event.target.value })}
                  >
                    <option>Invoice</option>
                    <option>Receipt</option>
                    <option>Contract</option>
                    <option>Supplier</option>
                    <option>Other</option>
                  </select>
                </label>
                <label className="documents-file">
                  File
                  <input
                    type="file"
                    onChange={(event) =>
                      setUploadForm({ ...uploadForm, file: event.target.files?.[0] || null })
                    }
                  />
                  {uploadForm.file ? <span>{uploadForm.file.name}</span> : null}
                </label>
                {uploadError && <p className="documents-error">{uploadError}</p>}
                <button type="submit" className="documents-primary" disabled={uploading}>
                  <AppIcon icon={faCloudArrowUp} /> {uploading ? "Uploading..." : "Upload document"}
                </button>
              </form>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default AdminDocuments;
