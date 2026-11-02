import {
  defaultEnquiryCopy,
  defaultInvitationCopy,
  enquiryTemplate,
  invitationTemplate,
} from "./enquiry-template.js";

// Plain configuration/renderers only: safe for the isolated browser demo.
export const emailTemplateOptions = Object.freeze([
  {
    slug: "enquiry-acknowledgement",
    label: "Enquiry acknowledgement",
    description:
      "Edit the message travellers receive after submitting an enquiry.",
    automated: true,
  },
  {
    slug: "staff-invitation",
    label: "Staff invitation",
    description:
      "Prepare invitation copy for your staff. Activation codes are still issued and shared separately in Staff access; no automatic invitation delivery is connected.",
    automated: false,
  },
]);
export const defaultTemplateCopies = Object.freeze({
  "enquiry-acknowledgement": defaultEnquiryCopy,
  "staff-invitation": defaultInvitationCopy,
});
export function renderEmailTemplate(slug, copy) {
  if (slug === "enquiry-acknowledgement")
    return enquiryTemplate({ name: "Sample traveller", copy });
  if (slug === "staff-invitation") return invitationTemplate({ copy });
  throw new Error("Unknown email template.");
}
