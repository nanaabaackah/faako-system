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

export const buildAccountInvitationEmailContent = ({
  recipientName,
  setupUrl,
  expiresInHours,
}) => {
  const safeRecipient = String(recipientName || "").trim() || "there";
  const safeUrl = String(setupUrl || "").trim();
  const expiryLabel = `${expiresInHours} hour${expiresInHours === 1 ? "" : "s"}`;
  const subject = "You have been invited to join Regimanuel Rent Tracker";
  const text = [
    `Hi ${safeRecipient},`,
    "",
    "You have been invited to join Regimanuel Rent Tracker.",
    `Use the link below to set up your account password (expires in ${expiryLabel}):`,
    "",
    safeUrl,
    "",
    "If you did not expect this invitation, you can ignore this email.",
  ].join("\n");

  const introHtml = [
    renderParagraphs(
      [
        `Hello ${safeRecipient},`,
        "An administrator created an account for you in Regimanuel Rent Tracker. Use the secure link below to finish setup and create your password.",
      ],
      { theme: EMAIL_THEMES.devErp }
    ),
    `<div style="margin:0 0 18px;">${renderButton({
      href: safeUrl,
      label: "Set up account",
      theme: EMAIL_THEMES.devErp,
    })}</div>`,
  ].join("");

  const bodyHtml = [
    renderPanel({
      theme: EMAIL_THEMES.devErp,
      eyebrow: "Account setup",
      title: "Invitation details",
      bodyHtml: renderKeyValueTable(
        [
          ["Workspace", "Regimanuel Rent Tracker"],
          ["Recipient", safeRecipient],
          ["Setup link expires", expiryLabel],
        ],
        { theme: EMAIL_THEMES.devErp }
      ),
    }),
    renderNotice({
      theme: EMAIL_THEMES.devErp,
      title: "Need the link manually?",
      lines: [
        "If the button does not open, copy and paste this link into your browser:",
        safeUrl,
      ],
    }),
    renderPanel({
      theme: EMAIL_THEMES.devErp,
      title: "Security note",
      bodyHtml: renderParagraphs(
        "If you did not expect this invitation, you can ignore this email.",
        { theme: EMAIL_THEMES.devErp, color: EMAIL_THEMES.devErp.muted, spacing: "0" }
      ),
    }),
  ].join("");

  const html = renderEmailLayout({
    theme: EMAIL_THEMES.devErp,
    preheader: `Set up your Regimanuel Rent Tracker account. This invitation expires in ${expiryLabel}.`,
    brandName: "Regimanuel Rent Tracker",
    brandTagline: "Property and rent operations",
    eyebrow: "Account invitation",
    title: "Set up your account",
    subtitle: "Finish your password setup to access the dashboard securely.",
    introHtml,
    bodyHtml,
    footerHtml: `<p style="margin:6px 0 0;color:${EMAIL_THEMES.devErp.muted};font:400 13px/1.65 Arial,sans-serif;">Sent by Regimanuel Rent Tracker.</p>`,
  });

  return { subject, text, html };
};
