import {
  defaultEnquiryCopy,
  defaultInvitationCopy,
  enquiryTemplate,
  invitationTemplate,
} from "./enquiry-template.js";

// Plain configuration/renderers only: shared by email rendering and isolated tests.
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
      "Prepare invitation copy for your staff. When enabled, a verified administrator can queue a secure invitation email from Staff access. Otherwise codes are shared privately.",
    automated: true,
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
