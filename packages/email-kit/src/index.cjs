"use strict";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeHtmlWithLineBreaks = (value) =>
  escapeHtml(value).replace(/\r?\n/g, "<br />");

const EMAIL_THEMES = {
  reebs: {
    pageBg: "#edf4fb",
    pageAccent: "#d7e7f6",
    surfaceBg: "#ffffff",
    border: "#d7e2ee",
    text: "#0f2139",
    muted: "#5e7189",
    heading: "#0a1830",
    heroFrom: "#12284a",
    heroTo: "#0f766e",
    heroText: "#f8fbff",
    heroMuted: "#d6ebf4",
    accent: "#0ea5a4",
    accentDark: "#0b7c7b",
    accentSoft: "#e8fbfb",
    accentBorder: "#9edfdc",
    noteBg: "#effcf9",
    noteBorder: "#99f6e4",
    noteText: "#0f766e",
    warnBg: "#fff7ed",
    warnBorder: "#fdba74",
    warnText: "#9a3412",
    dangerBg: "#fef2f2",
    dangerBorder: "#fecaca",
    dangerText: "#b91c1c",
  },
  devErp: {
    pageBg: "#f5efe8",
    pageAccent: "#eadfd4",
    surfaceBg: "#ffffff",
    border: "#d9cec2",
    text: "#2d241f",
    muted: "#6e5f57",
    heading: "#241814",
    heroFrom: "#3b302b",
    heroTo: "#785948",
    heroText: "#fcf8f4",
    heroMuted: "#ead8cb",
    accent: "#a16207",
    accentDark: "#854d0e",
    accentSoft: "#fff7ed",
    accentBorder: "#f3d0a8",
    noteBg: "#f8fafc",
    noteBorder: "#cbd5e1",
    noteText: "#475569",
    warnBg: "#fff7ed",
    warnBorder: "#fdba74",
    warnText: "#9a3412",
    dangerBg: "#fef2f2",
    dangerBorder: "#fecaca",
    dangerText: "#b91c1c",
  },
  faako: {
    pageBg: "#eef5ff",
    pageAccent: "#d6e6ff",
    surfaceBg: "#ffffff",
    border: "#d6e2f3",
    text: "#10213b",
    muted: "#5a6f8a",
    heading: "#0d1c34",
    heroFrom: "#0f172a",
    heroTo: "#2563eb",
    heroText: "#f8fbff",
    heroMuted: "#dbeafe",
    accent: "#2563eb",
    accentDark: "#1d4ed8",
    accentSoft: "#eff6ff",
    accentBorder: "#bfdbfe",
    noteBg: "#eff6ff",
    noteBorder: "#bfdbfe",
    noteText: "#1d4ed8",
    warnBg: "#fff7ed",
    warnBorder: "#fdba74",
    warnText: "#9a3412",
    dangerBg: "#fef2f2",
    dangerBorder: "#fecaca",
    dangerText: "#b91c1c",
  },
  bynana: {
    pageBg: "#f4f7fb",
    pageAccent: "#d9e3f4",
    surfaceBg: "#ffffff",
    border: "#d5deea",
    text: "#172033",
    muted: "#61708a",
    heading: "#0f172a",
    heroFrom: "#0f172a",
    heroTo: "#1d4ed8",
    heroText: "#f8fbff",
    heroMuted: "#dbeafe",
    accent: "#2563eb",
    accentDark: "#1d4ed8",
    accentSoft: "#eff6ff",
    accentBorder: "#bfdbfe",
    noteBg: "#eff6ff",
    noteBorder: "#bfdbfe",
    noteText: "#1d4ed8",
    warnBg: "#fff7ed",
    warnBorder: "#fdba74",
    warnText: "#9a3412",
    dangerBg: "#fef2f2",
    dangerBorder: "#fecaca",
    dangerText: "#b91c1c",
  },
};

const resolveTheme = (theme) => ({
  ...EMAIL_THEMES.faako,
  ...(theme || {}),
});

const normalizeList = (value) => {
  if (Array.isArray(value)) {
    return value.filter((entry) => entry !== null && typeof entry !== "undefined" && String(entry).trim());
  }
  if (value === null || typeof value === "undefined") return [];
  const normalized = String(value).trim();
  return normalized ? [normalized] : [];
};

const chunkList = (items, size) => {
  const safeItems = Array.isArray(items) ? items : [];
  const chunkSize = Number.isFinite(size) && size > 0 ? Math.floor(size) : 1;
  const chunks = [];
  for (let index = 0; index < safeItems.length; index += chunkSize) {
    chunks.push(safeItems.slice(index, index + chunkSize));
  }
  return chunks;
};

const renderParagraphs = (value, { theme, color, spacing = "0 0 12px" } = {}) => {
  const safeTheme = resolveTheme(theme);
  return normalizeList(value)
    .map(
      (entry) =>
        `<p style="margin:${spacing};color:${color || safeTheme.text};font:400 15px/1.7 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">${escapeHtmlWithLineBreaks(
          entry
        )}</p>`
    )
    .join("");
};

const renderButton = ({ href, label, theme } = {}) => {
  const safeTheme = resolveTheme(theme);
  const safeHref = String(href || "").trim();
  const safeLabel = String(label || "").trim();
  if (!safeHref || !safeLabel) return "";
  return `<a href="${escapeHtml(
    safeHref
  )}" style="display:inline-block;padding:13px 20px;border-radius:999px;background:${safeTheme.accent};color:#ffffff;text-decoration:none;font:700 14px/1.35 Arial,sans-serif;letter-spacing:0.01em;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
    safeLabel
  )}</a>`;
};

const renderNotice = ({ title = "", lines = [], tone = "info", theme } = {}) => {
  const safeTheme = resolveTheme(theme);
  const palette =
    tone === "warning"
      ? { bg: safeTheme.warnBg, border: safeTheme.warnBorder, text: safeTheme.warnText }
      : tone === "danger"
        ? { bg: safeTheme.dangerBg, border: safeTheme.dangerBorder, text: safeTheme.dangerText }
        : { bg: safeTheme.noteBg, border: safeTheme.noteBorder, text: safeTheme.noteText };

  const body = normalizeList(lines)
    .map(
      (line) =>
        `<p style="margin:0 0 6px;color:${palette.text};font:600 13px/1.55 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">${escapeHtmlWithLineBreaks(
          line
        )}</p>`
    )
    .join("");

  if (!title && !body) return "";

  return `
    <div style="margin:0 0 18px;padding:14px 16px;border:1px solid ${palette.border};border-radius:16px;background:${palette.bg};">
      ${
        title
          ? `<p style="margin:0 0 8px;color:${palette.text};font:800 12px/1.2 Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(
              title
            )}</p>`
          : ""
      }
      ${body}
    </div>
  `.trim();
};

const renderPanel = ({ title = "", eyebrow = "", bodyHtml = "", theme } = {}) => {
  const safeTheme = resolveTheme(theme);
  if (!bodyHtml && !title && !eyebrow) return "";
  return `
    <div style="margin:0 0 18px;padding:18px;border:1px solid ${safeTheme.border};border-radius:18px;background:${safeTheme.surfaceBg};">
      ${
        eyebrow
          ? `<p style="margin:0 0 8px;color:${safeTheme.muted};font:800 11px/1.2 Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(
              eyebrow
            )}</p>`
          : ""
      }
      ${
        title
          ? `<h2 style="margin:0 0 12px;color:${safeTheme.heading};font:800 18px/1.25 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
              title
            )}</h2>`
          : ""
      }
      ${bodyHtml}
    </div>
  `.trim();
};

const renderKeyValueTable = (rows, { theme, labelWidth = "34%" } = {}) => {
  const safeTheme = resolveTheme(theme);
  const safeRows = (Array.isArray(rows) ? rows : [])
    .filter((row) => Array.isArray(row) && row.length >= 2)
    .map(([label, value]) => [String(label ?? "").trim(), value]);

  if (!safeRows.length) return "";

  return `
    <table class="email-kv-table" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid ${safeTheme.border};border-radius:16px;overflow:hidden;">
      <tbody>
        ${safeRows
          .map(
            ([label, value], index) => `
              <tr class="email-kv-row">
                <td class="email-kv-cell email-kv-label" style="width:${labelWidth};padding:11px 12px;border:${index === 0 ? "0" : `1px solid ${safeTheme.border}`};border-left:0;border-right:1px solid ${safeTheme.border};background:${safeTheme.accentSoft};color:${safeTheme.heading};font:700 13px/1.45 Arial,sans-serif;vertical-align:top;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
                  label
                )}</td>
                <td class="email-kv-cell email-kv-value" style="padding:11px 12px;border:${index === 0 ? "0" : `1px solid ${safeTheme.border}`};border-left:0;border-right:0;color:${safeTheme.text};font:400 14px/1.55 Arial,sans-serif;vertical-align:top;word-break:break-word;overflow-wrap:anywhere;">${escapeHtmlWithLineBreaks(
                  value
                )}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `.trim();
};

const renderDataTable = ({ headers = [], rows = [], aligns = [], theme } = {}) => {
  const safeTheme = resolveTheme(theme);
  const safeHeaders = Array.isArray(headers) ? headers : [];
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeHeaders.length) return "";

  const headerHtml = safeHeaders
    .map(
      (header, index) =>
        `<th style="padding:11px 12px;border:1px solid ${safeTheme.border};background:${safeTheme.accentSoft};color:${safeTheme.heading};text-align:${aligns[index] || "left"};font:700 13px/1.35 Arial,sans-serif;">${escapeHtml(
          header
        )}</th>`
    )
    .join("");

  const rowHtml = safeRows.length
    ? safeRows
        .map(
          (row) => `
            <tr>
              ${(Array.isArray(row) ? row : [])
                .map(
                  (cell, index) =>
                    `<td style="padding:11px 12px;border:1px solid ${safeTheme.border};text-align:${aligns[index] || "left"};color:${safeTheme.text};font:400 14px/1.55 Arial,sans-serif;vertical-align:top;word-break:break-word;overflow-wrap:anywhere;">${escapeHtmlWithLineBreaks(
                      cell
                    )}</td>`
                )
                .join("")}
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="${safeHeaders.length}" style="padding:14px 12px;border:1px solid ${safeTheme.border};color:${safeTheme.muted};font:400 14px/1.55 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">No items available.</td></tr>`;

  const mobileCardHtml = safeRows.length
    ? safeRows
        .map(
          (row) => `
            <div class="email-mobile-card" style="display:none;max-height:0;overflow:hidden;margin:0 0 12px;padding:14px 14px 4px;border:1px solid ${safeTheme.border};border-radius:16px;background:${safeTheme.surfaceBg};">
              ${(Array.isArray(row) ? row : [])
                .map((cell, index) => {
                  const headerLabel = String(safeHeaders[index] ?? "").trim();
                  if (!headerLabel) return "";
                  return `
                    <div style="margin:0 0 10px;">
                      <p style="margin:0 0 4px;color:${safeTheme.muted};font:800 11px/1.2 Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(
                        headerLabel
                      )}</p>
                      <p style="margin:0;color:${safeTheme.text};font:400 14px/1.6 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">${escapeHtmlWithLineBreaks(
                        cell
                      )}</p>
                    </div>
                  `;
                })
                .join("")}
            </div>
          `
        )
        .join("")
    : `<div class="email-mobile-card" style="display:none;max-height:0;overflow:hidden;margin:0;padding:14px;border:1px solid ${safeTheme.border};border-radius:16px;background:${safeTheme.surfaceBg};color:${safeTheme.muted};font:400 14px/1.55 Arial,sans-serif;">No items available.</div>`;

  return `
    <div class="email-desktop-table" style="display:block;">
      <table class="email-data-table" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid ${safeTheme.border};border-radius:16px;overflow:hidden;table-layout:fixed;">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowHtml}</tbody>
      </table>
    </div>
    <div class="email-mobile-table" style="display:none;max-height:0;overflow:hidden;">
      ${mobileCardHtml}
    </div>
  `.trim();
};

const renderMetricGrid = (metrics, { theme } = {}) => {
  const safeTheme = resolveTheme(theme);
  const safeMetrics = (Array.isArray(metrics) ? metrics : []).filter(
    (metric) => metric && String(metric.label || "").trim() && String(metric.value || "").trim()
  );
  if (!safeMetrics.length) return "";

  const metricRows = chunkList(safeMetrics, 2);

  return `
    <table class="email-metric-table" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0 10px;margin:0 0 18px;">
      <tbody>
        ${metricRows
          .map(
            (metricRow) => `
              <tr>
                ${metricRow
                  .map(
                    (metric, index) => `
                      <td class="email-metric-cell" style="width:50%;padding:${index === 0 ? "0 10px 0 0" : "0 0 0 10px"};vertical-align:top;">
                        <div class="email-metric-card" style="padding:16px;border:1px solid ${safeTheme.border};border-radius:18px;background:${safeTheme.surfaceBg};">
                          <p style="margin:0 0 6px;color:${safeTheme.muted};font:700 11px/1.2 Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
                            metric.label
                          )}</p>
                          <p style="margin:0;color:${safeTheme.heading};font:800 20px/1.2 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
                            metric.value
                          )}</p>
                        </div>
                      </td>
                    `
                  )
                  .join("")}
                ${
                  metricRow.length < 2
                    ? `<td class="email-metric-cell email-metric-empty" style="width:50%;padding:0 0 0 10px;vertical-align:top;font-size:0;line-height:0;">&nbsp;</td>`
                    : ""
                }
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `.trim();
};

const renderList = (items, { theme, ordered = false } = {}) => {
  const safeTheme = resolveTheme(theme);
  const safeItems = normalizeList(items);
  if (!safeItems.length) return "";
  const tag = ordered ? "ol" : "ul";
  return `
    <${tag} style="margin:0;padding-left:${ordered ? "20px" : "18px"};color:${safeTheme.text};font:400 14px/1.65 Arial,sans-serif;">
      ${safeItems
        .map(
          (item) =>
            `<li style="margin:0 0 8px;word-break:break-word;overflow-wrap:anywhere;">${escapeHtmlWithLineBreaks(
              item
            )}</li>`
        )
        .join("")}
    </${tag}>
  `.trim();
};

const renderEmailLayout = ({
  theme,
  preheader = "",
  brandName = "",
  brandTagline = "",
  eyebrow = "",
  title = "",
  subtitle = "",
  introHtml = "",
  bodyHtml = "",
  footerHtml = "",
} = {}) => {
  const safeTheme = resolveTheme(theme);
  const safeBrandName = String(brandName || "").trim();
  const safeBrandTagline = String(brandTagline || "").trim();
  const safeEyebrow = String(eyebrow || "").trim();
  const safeTitle = String(title || "").trim();
  const safeSubtitle = String(subtitle || "").trim();
  const safePreheader = String(preheader || "").trim();

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="x-apple-disable-message-reformatting" />
        <title>${escapeHtml(safeTitle || safeBrandName || "Email")}</title>
        <style>
          @media only screen and (max-width: 620px) {
            .email-shell {
              padding: 16px !important;
            }
            .email-frame {
              border-radius: 22px !important;
            }
            .email-hero,
            .email-body {
              padding: 22px 18px !important;
            }
            .email-title {
              font-size: 24px !important;
              line-height: 1.18 !important;
            }
            .email-subtitle {
              margin-top: 10px !important;
              font-size: 14px !important;
              line-height: 1.6 !important;
            }
            .email-metric-table,
            .email-metric-table tbody,
            .email-metric-table tr,
            .email-metric-cell {
              display: block !important;
              width: 100% !important;
            }
            .email-metric-cell {
              padding: 0 0 10px 0 !important;
            }
            .email-metric-empty {
              display: none !important;
            }
            .email-column-table,
            .email-column-table tbody,
            .email-column-table tr,
            .email-column-cell {
              display: block !important;
              width: 100% !important;
            }
            .email-column-cell {
              padding: 0 0 12px 0 !important;
            }
            .email-column-cell:last-child {
              padding-bottom: 0 !important;
            }
            .email-kv-table,
            .email-kv-table tbody,
            .email-kv-row,
            .email-kv-cell {
              display: block !important;
              width: 100% !important;
            }
            .email-kv-row {
              border-bottom: 1px solid ${safeTheme.border} !important;
            }
            .email-kv-row:last-child {
              border-bottom: 0 !important;
            }
            .email-kv-label {
              border-right: 0 !important;
              border-bottom: 1px solid ${safeTheme.border} !important;
            }
            .email-kv-value {
              border-top: 0 !important;
            }
            .email-desktop-table {
              display: none !important;
              max-height: 0 !important;
              overflow: hidden !important;
              mso-hide: all !important;
            }
            .email-mobile-table {
              display: block !important;
              max-height: none !important;
              overflow: visible !important;
            }
            .email-mobile-card {
              display: block !important;
              max-height: none !important;
              overflow: visible !important;
            }
          }
        </style>
      </head>
      <body style="margin:0;padding:0;background:${safeTheme.pageBg};">
        ${
          safePreheader
            ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;visibility:hidden;">${escapeHtml(
                safePreheader
              )}</div>`
            : ""
        }
        <div class="email-shell" style="margin:0;padding:24px;background:radial-gradient(circle at top right, ${safeTheme.pageAccent} 0%, ${safeTheme.pageBg} 48%);font-family:Arial,sans-serif;color:${safeTheme.text};">
          <div style="max-width:760px;margin:0 auto;">
            <div class="email-frame" style="overflow:hidden;border:1px solid ${safeTheme.border};border-radius:28px;background:${safeTheme.surfaceBg};box-shadow:0 24px 60px rgba(15,23,42,0.08);">
              <div class="email-hero" style="padding:28px 30px;background:linear-gradient(135deg, ${safeTheme.heroFrom} 0%, ${safeTheme.heroTo} 100%);color:${safeTheme.heroText};">
                ${
                  safeBrandName
                    ? `<p style="margin:0 0 10px;font:800 12px/1.2 Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;color:${safeTheme.heroMuted};word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
                        safeBrandName
                      )}</p>`
                    : ""
                }
                ${
                  safeEyebrow
                    ? `<p style="margin:0 0 10px;font:700 11px/1.2 Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:${safeTheme.heroMuted};word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
                        safeEyebrow
                      )}</p>`
                    : ""
                }
                ${
                  safeTitle
                    ? `<h1 class="email-title" style="margin:0;font:800 30px/1.12 Arial,sans-serif;color:${safeTheme.heroText};word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
                        safeTitle
                      )}</h1>`
                    : ""
                }
                ${
                  safeSubtitle || safeBrandTagline
                    ? `<p class="email-subtitle" style="margin:12px 0 0;max-width:560px;font:400 15px/1.65 Arial,sans-serif;color:${safeTheme.heroMuted};word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
                        safeSubtitle || safeBrandTagline
                      )}</p>`
                    : ""
                }
              </div>
              <div class="email-body" style="padding:28px 30px;background:${safeTheme.surfaceBg};">
                ${introHtml}
                ${bodyHtml}
                ${footerHtml}
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `.trim();
};

module.exports = {
  EMAIL_THEMES,
  escapeHtml,
  escapeHtmlWithLineBreaks,
  renderButton,
  renderDataTable,
  renderEmailLayout,
  renderKeyValueTable,
  renderList,
  renderMetricGrid,
  renderNotice,
  renderPanel,
  renderParagraphs,
};
