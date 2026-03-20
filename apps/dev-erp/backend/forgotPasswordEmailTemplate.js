import emailKit from "../../../packages/email-kit/src/index.cjs";

const {
  EMAIL_THEMES,
  renderButton,
  renderEmailLayout,
  renderKeyValueTable,
  renderNotice,
  renderPanel,
  renderParagraphs,
} = emailKit;

export const buildForgotPasswordEmailContent = ({ recipientName, resetUrl, expiresInHours }) => {
  const safeRecipient = String(recipientName || "").trim() || "there";
  const safeUrl = String(resetUrl || "").trim();
  const expiryLabel = `${expiresInHours} hour${expiresInHours === 1 ? "" : "s"}`;
  const subject = "Reset your Regimanuel Rent Tracker password";
  const text = [
    `Hi ${safeRecipient},`,
    "",
    "We received a request to reset your Regimanuel Rent Tracker password.",
    `Use the link below to set a new password (expires in ${expiryLabel}):`,
    "",
    safeUrl,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const introHtml = [
    renderParagraphs(
      [
        `Hello ${safeRecipient},`,
        "We received a request to reset the password for your Regimanuel Rent Tracker account. Use the secure link below to choose a new password.",
      ],
      { theme: EMAIL_THEMES.devErp }
    ),
    `<div style="margin:0 0 18px;">${renderButton({
      href: safeUrl,
      label: "Reset password",
      theme: EMAIL_THEMES.devErp,
    })}</div>`,
  ].join("");

  const bodyHtml = [
    renderPanel({
      theme: EMAIL_THEMES.devErp,
      eyebrow: "Password reset",
      title: "Reset details",
      bodyHtml: renderKeyValueTable(
        [
          ["Workspace", "Regimanuel Rent Tracker"],
          ["Recipient", safeRecipient],
          ["Link expires", expiryLabel],
        ],
        { theme: EMAIL_THEMES.devErp }
      ),
    }),
    renderNotice({
      theme: EMAIL_THEMES.devErp,
      title: "Manual link",
      lines: [
        "If the button does not open, copy and paste this reset link into your browser:",
        safeUrl,
      ],
    }),
    renderPanel({
      theme: EMAIL_THEMES.devErp,
      title: "Security note",
      bodyHtml: renderParagraphs(
        "If you did not request this, you can ignore this email.",
        { theme: EMAIL_THEMES.devErp, color: EMAIL_THEMES.devErp.muted, spacing: "0" }
      ),
    }),
  ].join("");

  const html = renderEmailLayout({
    theme: EMAIL_THEMES.devErp,
    preheader: `Reset your password for Regimanuel Rent Tracker. This link expires in ${expiryLabel}.`,
    brandName: "Regimanuel Rent Tracker",
    brandTagline: "Property and rent operations",
    eyebrow: "Password reset",
    title: "Reset your password",
    subtitle: "Use the secure link below to create a new password for your account.",
    introHtml,
    bodyHtml,
    footerHtml: `<p style="margin:6px 0 0;color:${EMAIL_THEMES.devErp.muted};font:400 13px/1.65 Arial,sans-serif;">Sent by Regimanuel Rent Tracker.</p>`,
  });

  return { subject, text, html };
};
