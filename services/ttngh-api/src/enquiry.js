import { z } from "zod";
import { emailSchema } from "@faako/validation";
export const topics = ["Programmes or support", "Events", "Volunteering", "Donations", "Partnerships", "Media collaboration", "Privacy question", "Other enquiry"];
const singleLine = z.string().trim().regex(/^[^\r\n\u0000-\u001f\u007f]+$/);
export const enquirySchema = z.object({
  name: singleLine.min(2).max(80), email: singleLine.max(160).pipe(emailSchema),
  topic: z.enum(topics), message: z.string().trim().min(20).max(2000).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+$/),
  consent: z.literal(true), website: z.string().max(200).default(""),
  turnstileToken: z.string().min(1).max(2048), submissionId: z.string().uuid(),
}).strict();

export async function verifyTurnstile(token, config, request = fetch) {
  const response = await request("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: config.secret, response: token }), redirect: "error", signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Verification unavailable");
  const result = await response.json();
  const age = Date.now() - Date.parse(result.challenge_ts);
  return result.success === true && config.hostnames.includes(result.hostname) && result.action === "ttngh_enquiry" && age >= -30000 && age <= 300000;
}

export async function sendEmail(message, key, config, request = fetch) {
  const response = await request("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${config.resendKey}`, "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({ from: config.from, ...message }), redirect: "error", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Email delivery unavailable");
  const result = await response.json();
  if (typeof result.id !== "string" || !result.id) throw new Error("Email delivery unconfirmed");
}

const escapeHtml = value =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export function staffMessage(input, config) {
  const website = "https://thethrivingnetworkgh.org";
  const logoUrl = `${website}/ttngh-logo-transparent.png`;

  const name = escapeHtml(input.name);
  const email = escapeHtml(input.email);
  const topic = escapeHtml(input.topic);
  const message = escapeHtml(input.message).replace(/\n/g, "<br>");
  const submissionId = escapeHtml(input.submissionId);

  return {
    to: [config.to],

    // Important: pressing Reply in the email client goes to the visitor.
    reply_to: input.email,

    subject: `New TTNGH website enquiry — ${input.topic}`,

    text: [
      "NEW WEBSITE ENQUIRY",
      "",
      `Name: ${input.name}`,
      `Email: ${input.email}`,
      `Category: ${input.topic}`,
      `Submission ID: ${input.submissionId}`,
      "",
      "MESSAGE",
      input.message,
      "",
      "REPLY",
      `Reply directly to this email to respond to ${input.name}.`,
      "",
      "PRIVACY & HANDLING",
      "This enquiry was submitted through the official TTNGH website with privacy consent.",
      "Handle the message according to TTNGH's mailbox retention, privacy and safeguarding procedures.",
      "Do not forward sensitive information unnecessarily.",
      "",
      "The Thriving Network GH",
      "Peace Over Everything.",
      website,
    ].join("\n"),

    html: `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >
  <title>New TTNGH website enquiry</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f6f6f6;
    font-family:Arial,Helvetica,sans-serif;
    color:#0a0a0a;
  "
>
  <!-- Inbox preview -->
  <div
    style="
      display:none;
      max-height:0;
      overflow:hidden;
      opacity:0;
      color:transparent;
    "
  >
    New ${topic} enquiry from ${name}.
  </div>

  <table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="
      width:100%;
      margin:0;
      padding:0;
      background:#f6f6f6;
    "
  >
    <tr>
      <td
        align="center"
        style="padding:32px 16px;"
      >

        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            width:100%;
            max-width:680px;
            background:#ffffff;
            border-collapse:collapse;
          "
        >

          <!-- LOGO HEADER -->
          <tr>
            <td
              style="
                padding:26px 36px 22px;
                background:#ffffff;
                border-bottom:4px solid #e52477;
              "
            >
              <a
                href="${website}"
                target="_blank"
                rel="noopener noreferrer"
                style="text-decoration:none;"
              >
                <img
                  src="${logoUrl}"
                  width="180"
                  alt="The Thriving Network GH"
                  style="
                    display:block;
                    width:180px;
                    max-width:100%;
                    height:auto;
                    border:0;
                  "
                >
              </a>
            </td>
          </tr>

          <!-- PINK HEADER -->
          <tr>
            <td
              style="
                padding:32px 36px 34px;
                background:#e52477;
                color:#ffffff;
              "
            >
              <div
                style="
                  margin-bottom:9px;
                  font-size:12px;
                  line-height:18px;
                  letter-spacing:1.6px;
                  text-transform:uppercase;
                  font-weight:700;
                  color:#ffffff;
                "
              >
                Website enquiry
              </div>

              <div
                style="
                  margin-bottom:10px;
                  font-size:29px;
                  line-height:37px;
                  font-weight:700;
                  color:#ffffff;
                "
              >
                A new message has arrived.
              </div>

              <div
                style="
                  font-size:15px;
                  line-height:23px;
                  color:#ffffff;
                "
              >
                ${topic}
              </div>
            </td>
          </tr>

          <!-- CONTENT -->
          <tr>
            <td style="padding:38px 36px 18px;">

              <!-- INTRO -->
              <p
                style="
                  margin:0 0 26px;
                  font-size:15px;
                  line-height:25px;
                  color:#4e4b4c;
                "
              >
                A new enquiry has been submitted through
                <strong style="color:#0a0a0a;">
                  thethrivingnetworkgh.org
                </strong>.
                The visitor provided the following information.
              </p>

              <!-- SENDER INFORMATION -->
              <div
                style="
                  margin-bottom:28px;
                  border:1px solid #e2e2e2;
                  background:#ffffff;
                "
              >
                <div
                  style="
                    padding:14px 18px;
                    background:#f5e4ec;
                    border-bottom:1px solid #e2e2e2;
                    font-size:12px;
                    line-height:18px;
                    letter-spacing:1.4px;
                    text-transform:uppercase;
                    font-weight:700;
                    color:#b41558;
                  "
                >
                  Sender details
                </div>

                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    width:100%;
                    border-collapse:collapse;
                  "
                >
                  <tr>
                    <td
                      style="
                        width:120px;
                        padding:16px 18px 8px;
                        vertical-align:top;
                        font-size:12px;
                        line-height:20px;
                        font-weight:700;
                        color:#6b6768;
                      "
                    >
                      Name
                    </td>

                    <td
                      style="
                        padding:16px 18px 8px 0;
                        font-size:14px;
                        line-height:22px;
                        color:#0a0a0a;
                      "
                    >
                      ${name}
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        width:120px;
                        padding:8px 18px;
                        vertical-align:top;
                        font-size:12px;
                        line-height:20px;
                        font-weight:700;
                        color:#6b6768;
                      "
                    >
                      Email
                    </td>

                    <td
                      style="
                        padding:8px 18px 8px 0;
                        font-size:14px;
                        line-height:22px;
                      "
                    >
                      <a
                        href="mailto:${email}"
                        style="
                          color:#c51f69;
                          text-decoration:underline;
                        "
                      >
                        ${email}
                      </a>
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        width:120px;
                        padding:8px 18px 16px;
                        vertical-align:top;
                        font-size:12px;
                        line-height:20px;
                        font-weight:700;
                        color:#6b6768;
                      "
                    >
                      Category
                    </td>

                    <td
                      style="
                        padding:8px 18px 16px 0;
                        font-size:14px;
                        line-height:22px;
                        color:#0a0a0a;
                      "
                    >
                      ${topic}
                    </td>
                  </tr>
                </table>
              </div>

              <!-- MESSAGE -->
              <p
                style="
                  margin:0 0 8px;
                  font-size:12px;
                  line-height:18px;
                  letter-spacing:1.4px;
                  text-transform:uppercase;
                  font-weight:700;
                  color:#c51f69;
                "
              >
                Message
              </p>

              <div
                style="
                  margin-bottom:28px;
                  padding:24px;
                  background:#fafafa;
                  border-left:4px solid #0a0a0a;
                  font-size:15px;
                  line-height:25px;
                  color:#222222;
                "
              >
                ${message}
              </div>

              <!-- REPLY CTA -->
              <table
                role="presentation"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="margin:0 0 34px;"
              >
                <tr>
                  <td
                    style="
                      background:#0a0a0a;
                    "
                  >
                    <a
                      href="mailto:${email}?subject=${encodeURIComponent(
                        `Re: ${input.topic} — The Thriving Network GH`
                      )}"
                      style="
                        display:inline-block;
                        padding:15px 22px;
                        font-size:14px;
                        line-height:18px;
                        font-weight:700;
                        color:#ffffff;
                        text-decoration:none;
                      "
                    >
                      Reply to ${name} →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- PRIVACY / OPERATIONS -->
              <div
                style="
                  padding:22px 24px;
                  background:#f5e4ec;
                  border-left:4px solid #e52477;
                "
              >
                <div
                  style="
                    margin-bottom:7px;
                    font-size:12px;
                    line-height:18px;
                    letter-spacing:1.4px;
                    text-transform:uppercase;
                    font-weight:700;
                    color:#b41558;
                  "
                >
                  Privacy &amp; handling
                </div>

                <p
                  style="
                    margin:0;
                    font-size:13px;
                    line-height:22px;
                    color:#4e4b4c;
                  "
                >
                  This enquiry was submitted through the official TTNGH
                  website with privacy consent. Handle the information
                  according to TTNGH's mailbox retention, privacy and
                  safeguarding procedures. Do not forward personal or
                  sensitive information unnecessarily.
                </p>
              </div>

              <!-- REFERENCE -->
              <div
                style="
                  margin-top:26px;
                  padding-top:20px;
                  border-top:1px solid #e2e2e2;
                "
              >
                <div
                  style="
                    margin-bottom:5px;
                    font-size:11px;
                    line-height:18px;
                    text-transform:uppercase;
                    letter-spacing:1.2px;
                    font-weight:700;
                    color:#888888;
                  "
                >
                  Submission reference
                </div>

                <div
                  style="
                    font-family:monospace;
                    font-size:12px;
                    line-height:20px;
                    color:#4e4b4c;
                    word-break:break-all;
                  "
                >
                  ${submissionId}
                </div>
              </div>

            </td>
          </tr>

          <!-- SIGNATURE -->
          <tr>
            <td style="padding:20px 36px 34px;">
              <div
                style="
                  font-size:24px;
                  line-height:31px;
                  font-weight:700;
                  color:#e52477;
                "
              >
                Peace Over Everything.
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td
              style="
                padding:28px 36px;
                background:#0a0a0a;
                color:#ffffff;
              "
            >
              <img
                src="${logoUrl}"
                width="120"
                alt="The Thriving Network GH"
                style="
                  display:block;
                  width:120px;
                  max-width:100%;
                  height:auto;
                  margin-bottom:18px;
                "
              >

              <div
                style="
                  font-size:13px;
                  line-height:21px;
                  color:#d7d7d7;
                "
              >
                The Thriving Network GH<br>
                Registered NGO · Tema, Ghana<br>

                <a
                  href="${website}"
                  style="
                    color:#ffffff;
                    text-decoration:none;
                  "
                >
                  thethrivingnetworkgh.org
                </a>
              </div>

              <div
                style="
                  margin-top:18px;
                  padding-top:16px;
                  border-top:1px solid #333333;
                  font-size:11px;
                  line-height:18px;
                  color:#969696;
                "
              >
                Internal website enquiry notification.
                The sender's email address is configured as the Reply-To
                address for this message.
              </div>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  };
}

export function acknowledgementMessage(input) {
  const name = escapeHtml(input.name);

  const website = "https://thethrivingnetworkgh.org";
  const contactUrl = `${website}/contact`;
  const logoUrl = `${website}/ttngh-logo-transparent.png`;

  const email = "thethrivingnetwork@gmail.com";
  const phone = "+233 (0) 209 570 047";

  return {
    to: [input.email],

    subject: "We’ve received your enquiry | The Thriving Network GH",

    text: [
      `Hello ${input.name},`,
      "",
      "Thank you for reaching out to The Thriving Network GH.",
      "",
      "We’ve received your enquiry and it has been sent to our team for review.",
      "",
      "WHAT HAPPENS NEXT",
      "A member of the TTNGH team will review your message and respond using the contact details you provided where a response is required.",
      "",
      "ABOUT THE THRIVING NETWORK GH",
      "The Thriving Network GH is a registered nonprofit organisation based in Tema, Ghana, advancing mental wellness through education, advocacy, counselling and community support.",
      "",
      "Our work includes:",
      "• Mental Health Education",
      "• Counselling & Support Services",
      "• Advocacy & Awareness",
      "• Research & Policy Engagement",
      "",
      "Peace Over Everything.",
      "",
      `Website: ${website}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      "",
      "A NOTE ABOUT YOUR PRIVACY",
      "Please do not reply with medical records, diagnoses or other highly sensitive personal information. This email confirms receipt of your website enquiry only.",
      "",
      "DIDN’T SUBMIT THIS ENQUIRY?",
      "If you received this message by mistake, no action is required. You can safely ignore or delete this email.",
      `If you believe your email address has been used improperly, contact us at ${email}.`,
      "",
      "The Thriving Network GH",
      "Tema, Ghana",
      "Peace Over Everything.",
    ].join("\n"),

    html: `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>We’ve received your enquiry</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f6f6f6;
    font-family:Arial,Helvetica,sans-serif;
    color:#0a0a0a;
  "
>
  <!-- Email preview text -->
  <div
    style="
      display:none;
      max-height:0;
      overflow:hidden;
      opacity:0;
      color:transparent;
    "
  >
    Your enquiry has been received by The Thriving Network GH.
  </div>

  <table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="width:100%;background:#f6f6f6;margin:0;padding:0;"
  >
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            width:100%;
            max-width:640px;
            background:#ffffff;
            border-collapse:collapse;
          "
        >

          <!-- LOGO -->
          <tr>
            <td
              style="
                background:#ffffff;
                padding:28px 36px 22px;
                border-bottom:4px solid #e52477;
              "
            >
              <a
                href="${website}"
                target="_blank"
                rel="noopener noreferrer"
                style="text-decoration:none;"
              >
                <img
                  src="${logoUrl}"
                  width="190"
                  alt="The Thriving Network GH"
                  style="
                    display:block;
                    width:190px;
                    max-width:100%;
                    height:auto;
                    border:0;
                  "
                >
              </a>
            </td>
          </tr>

          <!-- PINK HERO -->
          <tr>
            <td
              style="
                background:#e52477;
                padding:34px 36px 38px;
              "
            >
              <div
                style="
                  font-size:12px;
                  line-height:18px;
                  letter-spacing:1.7px;
                  text-transform:uppercase;
                  font-weight:700;
                  color:#ffffff;
                  margin-bottom:10px;
                "
              >
                Enquiry received
              </div>

              <div
                style="
                  font-size:30px;
                  line-height:38px;
                  font-weight:700;
                  color:#ffffff;
                  margin-bottom:12px;
                "
              >
                We’ve received your message.
              </div>

              <div
                style="
                  font-size:15px;
                  line-height:24px;
                  color:#ffffff;
                "
              >
                Peace Over Everything.
              </div>
            </td>
          </tr>

          <!-- MAIN CONTENT -->
          <tr>
            <td style="padding:40px 36px 20px;">

              <p
                style="
                  margin:0 0 18px;
                  font-size:17px;
                  line-height:28px;
                  color:#0a0a0a;
                "
              >
                Hello ${name},
              </p>

              <p
                style="
                  margin:0 0 18px;
                  font-size:16px;
                  line-height:27px;
                  color:#4e4b4c;
                "
              >
                Thank you for reaching out to
                <strong>The Thriving Network GH</strong>.
                Your enquiry has been received and sent to our team
                for review.
              </p>

              <!-- WHAT HAPPENS NEXT -->
              <div
                style="
                  margin:28px 0;
                  padding:22px 24px;
                  background:#f5e4ec;
                  border-left:4px solid #e52477;
                "
              >
                <div
                  style="
                    font-size:12px;
                    line-height:18px;
                    letter-spacing:1.5px;
                    text-transform:uppercase;
                    font-weight:700;
                    color:#b41558;
                    margin-bottom:7px;
                  "
                >
                  What happens next
                </div>

                <p
                  style="
                    margin:0;
                    font-size:15px;
                    line-height:24px;
                    color:#0a0a0a;
                  "
                >
                  A member of the TTNGH team will review your message
                  and respond using the contact details you provided
                  where a response is required.
                </p>
              </div>

              <!-- ABOUT -->
              <p
                style="
                  margin:0 0 8px;
                  font-size:12px;
                  line-height:18px;
                  letter-spacing:1.5px;
                  text-transform:uppercase;
                  font-weight:700;
                  color:#c51f69;
                "
              >
                About us
              </p>

              <h2
                style="
                  margin:0 0 14px;
                  font-size:23px;
                  line-height:30px;
                  color:#0a0a0a;
                "
              >
                Creating space for people to learn, connect and seek support.
              </h2>

              <p
                style="
                  margin:0 0 22px;
                  font-size:15px;
                  line-height:25px;
                  color:#4e4b4c;
                "
              >
                The Thriving Network GH is a registered nonprofit organisation
                based in Tema, Ghana, advancing mental wellness through
                education, advocacy, counselling and community support.
              </p>

              <!-- PILLARS -->
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                  width:100%;
                  border-top:1px solid #d9d9d9;
                  border-bottom:1px solid #d9d9d9;
                "
              >
                <tr>
                  <td
                    style="
                      padding:18px 0;
                      font-size:14px;
                      line-height:23px;
                      color:#4e4b4c;
                    "
                  >
                    Mental Health Education
                  </td>

                  <td
                    align="right"
                    style="
                      padding:18px 0;
                      font-size:14px;
                      line-height:23px;
                      color:#4e4b4c;
                    "
                  >
                    Counselling &amp; Support
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:0 0 18px;
                      font-size:14px;
                      line-height:23px;
                      color:#4e4b4c;
                    "
                  >
                    Advocacy &amp; Awareness
                  </td>

                  <td
                    align="right"
                    style="
                      padding:0 0 18px;
                      font-size:14px;
                      line-height:23px;
                      color:#4e4b4c;
                    "
                  >
                    Research &amp; Policy
                  </td>
                </tr>
              </table>

              <!-- WEBSITE CTA -->
              <table
                role="presentation"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="margin:30px 0;"
              >
                <tr>
                  <td style="background:#0a0a0a;">
                    <a
                      href="${website}"
                      target="_blank"
                      rel="noopener noreferrer"
                      style="
                        display:inline-block;
                        padding:14px 22px;
                        font-size:14px;
                        line-height:18px;
                        font-weight:700;
                        color:#ffffff;
                        text-decoration:none;
                      "
                    >
                      Visit The Thriving Network GH →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- PRIVACY -->
              <div
                style="
                  padding:20px 0;
                  border-top:1px solid #d9d9d9;
                "
              >
                <p
                  style="
                    margin:0 0 6px;
                    font-size:13px;
                    line-height:21px;
                    font-weight:700;
                    color:#0a0a0a;
                  "
                >
                  A note about your privacy
                </p>

                <p
                  style="
                    margin:0;
                    font-size:13px;
                    line-height:21px;
                    color:#6b6768;
                  "
                >
                  Please do not reply with medical records, diagnoses
                  or other highly sensitive personal information.
                  This email confirms receipt of your website enquiry only.
                </p>
              </div>

              <!-- MISTAKEN EMAIL -->
              <div
                style="
                  margin-top:10px;
                  padding:20px 22px;
                  background:#fafafa;
                  border:1px solid #e4e4e4;
                "
              >
                <p
                  style="
                    margin:0 0 6px;
                    font-size:13px;
                    line-height:21px;
                    font-weight:700;
                    color:#0a0a0a;
                  "
                >
                  Didn’t submit this enquiry?
                </p>

                <p
                  style="
                    margin:0;
                    font-size:13px;
                    line-height:21px;
                    color:#6b6768;
                  "
                >
                  If you received this message by mistake, no action
                  is required. You can safely ignore or delete it.
                  If you believe your email address has been used improperly,
                  please
                  <a
                    href="${contactUrl}"
                    style="
                      color:#c51f69;
                      text-decoration:underline;
                    "
                  >
                    contact us
                  </a>.
                </p>
              </div>

            </td>
          </tr>

          <!-- TAGLINE -->
          <tr>
            <td style="padding:20px 36px 34px;">
              <div
                style="
                  font-size:24px;
                  line-height:31px;
                  font-weight:700;
                  color:#e52477;
                "
              >
                Peace Over Everything.
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td
              style="
                background:#0a0a0a;
                padding:30px 36px;
                color:#ffffff;
              "
            >

              <img
                src="${logoUrl}"
                width="130"
                alt="The Thriving Network GH"
                style="
                  display:block;
                  width:130px;
                  max-width:100%;
                  height:auto;
                  margin-bottom:20px;
                "
              >

              <div
                style="
                  font-size:15px;
                  line-height:23px;
                  font-weight:700;
                  margin-bottom:8px;
                "
              >
                The Thriving Network GH
              </div>

              <div
                style="
                  font-size:12px;
                  line-height:20px;
                  color:#d7d7d7;
                "
              >
                Registered NGO · Tema, Ghana
                <br>

                <a
                  href="${website}"
                  style="
                    color:#ffffff;
                    text-decoration:none;
                  "
                >
                  thethrivingnetworkgh.org
                </a>

                <br>

                <a
                  href="mailto:${email}"
                  style="
                    color:#ffffff;
                    text-decoration:none;
                  "
                >
                  ${email}
                </a>

                <br>

                <a
                  href="tel:+233209570047"
                  style="
                    color:#ffffff;
                    text-decoration:none;
                  "
                >
                  ${phone}
                </a>
              </div>

              <div
                style="
                  margin-top:20px;
                  padding-top:18px;
                  border-top:1px solid #333333;
                  font-size:11px;
                  line-height:18px;
                  color:#9f9f9f;
                "
              >
                This automated acknowledgement was sent because an enquiry
                was submitted using this email address on
                The Thriving Network GH website.
              </div>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  };
}