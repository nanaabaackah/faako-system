const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );

// Brand and approved contact channels only; omit private business identifiers.
export const defaultEnquiryCopy = Object.freeze({
  subject: "Travel With Ease — enquiry received",
  heading: "We’ve received your enquiry",
  message:
    "Thank you for contacting Travel With Ease. Your enquiry has been received. Our team will review your plans and contact you about the next steps.",
  ctaLabel: "Visit Travel With Ease",
});
export const defaultInvitationCopy = Object.freeze({
  subject: "You’re invited to the Travel With Ease workspace",
  heading: "Join your Travel With Ease team",
  message:
    "Your workspace owner has invited you to join Travel With Ease. Contact the person who invited you for your activation code and instructions.",
  ctaLabel: "Open staff workspace",
});

export function enquiryTemplate({
  name = "",
  test = false,
  copy = defaultEnquiryCopy,
} = {}) {
  const greeting = name.trim()
    ? `Hello ${name.trim().slice(0, 160)},`
    : "Hello,";
  const heading = test ? "Email delivery preview" : copy.heading;
  const message = test
    ? "This is a test of the Travel With Ease email template. No enquiry, booking or payment was created by this preview."
    : `${copy.message}\n\nThis acknowledgement is not a booking or payment confirmation.`;
  return brandedEmail({
    heading,
    message,
    greeting,
    copy,
    subject: test ? "Travel With Ease — email delivery preview" : copy.subject,
  });
}

export function invitationTemplate({ copy = defaultInvitationCopy } = {}) {
  return brandedEmail({
    heading: copy.heading,
    greeting: "Hello,",
    message: `${copy.message}\n\nUse your invited account to sign in through Cloudflare Access and complete the required verification. Your owner shares the activation code separately. This email does not grant workspace access. Never share your password or verification codes.`,
    copy,
    subject: copy.subject,
    ctaUrl: "https://portal.travelwitheasegh.com/",
  });
}

function brandedEmail({
  heading,
  message,
  greeting,
  copy,
  subject,
  ctaUrl = "https://travelwitheasegh.com",
}) {
  const automatic =
    "This email was sent automatically by Travel With Ease. For assistance, contact nana@travelwitheasegh.com.";
  const text = `${heading}\n\n${greeting}\n\n${message}\n\n${copy.ctaLabel}: ${ctaUrl}\n\nTravel With Ease — Travel planning from Ghana.\nTravel planning, travel packages and group trips.\nnana@travelwitheasegh.com | +233 20 020 9170\nWhatsApp: https://wa.me/233208387020\nWebsite: https://travelwitheasegh.com\nInstagram: https://www.instagram.com/travelwitheasegh/\nTikTok: https://www.tiktok.com/@travelwitheaseghana\n\n${automatic}`;
  // Inline styles and presentation tables are intentional for email clients.
  const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;background:#f4ede3;color:#010c33;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff">
<tr><td style="padding:28px;background:#010c33"><a href="https://travelwitheasegh.com"><img src="https://travelwitheasegh.com/brand/Primary%20gold.png" width="208" alt="Travel With Ease" style="display:block;width:208px;max-width:100%;height:auto;border:0;color:#d8b56a"></a></td></tr>
<tr><td style="padding:32px 24px;border-top:4px solid #d8b56a"><h1 style="margin:0 0 24px;font-size:26px;line-height:1.3">${escapeHtml(heading)}</h1>
<p style="font-size:16px;line-height:1.65">${escapeHtml(greeting)}</p><p style="font-size:16px;line-height:1.65;white-space:pre-line">${escapeHtml(message)}</p>
<p style="margin:28px 0 8px"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 20px;background:#010c33;color:#ffffff;text-decoration:none;font-weight:bold">${escapeHtml(copy.ctaLabel)}</a></p></td></tr>
<tr><td style="padding:24px;background:#f4ede3;font-size:13px;line-height:1.7">
<strong style="font-size:16px">Travel planning from Ghana.</strong><p>Travel planning, travel packages and group trips.</p>
<p><a href="mailto:nana@travelwitheasegh.com" style="color:#010c33">nana@travelwitheasegh.com</a><br><a href="tel:+233200209170" style="color:#010c33">+233 20 020 9170</a> · <a href="https://wa.me/233208387020" style="color:#010c33">WhatsApp</a></p>
<p><a href="https://www.instagram.com/travelwitheasegh/" style="display:inline-block;padding:12px 8px 12px 0;color:#010c33"><img src="https://travelwitheasegh.com/brand/social/instagram.png" width="24" height="24" alt="" style="vertical-align:middle;border:0"> Instagram</a> <a href="https://www.tiktok.com/@travelwitheaseghana" style="display:inline-block;padding:12px 8px;color:#010c33"><img src="https://travelwitheasegh.com/brand/social/tiktok.png" width="24" height="24" alt="" style="vertical-align:middle;border:0"> TikTok</a></p>
<p style="border-top:1px solid #b6b1a9;padding-top:16px">${automatic}</p>
</td></tr></table></td></tr></table></body></html>`;
  return {
    subject,
    html,
    text,
  };
}
