import {
  defaultEnquiryCopy,
  defaultInvitationCopy,
  enquiryTemplate,
  invitationTemplate,
} from "./enquiry-template.js";
import { SERVICE_OPTIONS } from "../enquiries/questionnaires/index.js";

export const generalTemplateSlug = "enquiry-acknowledgement";
export const packageTemplateSlug = "enquiry-package";
export const packageTemplatePattern = /^enquiry-package-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const serviceOptions = SERVICE_OPTIONS.map(service => ({
  slug: "enquiry-service-" + service.id.replaceAll("_", "-"), label: service.title,
  automated: true, context: "service", serviceId: service.id,
}));
const typeOptions = [
  { slug: "enquiry-gift", label: "Travel gift", automated: true },
  { slug: "enquiry-group", label: "Group enquiry", automated: true },
  { slug: "enquiry-celebration", label: "Celebration enquiry", automated: true },
];
export const emailTemplateOptions = Object.freeze([
  { slug: generalTemplateSlug, label: "Enquiry acknowledgement", automated: true },
  ...serviceOptions,
  { slug: packageTemplateSlug, label: "Package enquiry", automated: true },
  ...typeOptions,
  { slug: "staff-invitation", label: "Staff invitation", automated: false },
]);
const contextualCopy = (label, message) => Object.freeze({
  ...defaultEnquiryCopy,
  subject: "Travel With Ease — " + label + " enquiry received",
  heading: "We’ve received your " + label.toLowerCase() + " enquiry",
  message,
});
export const defaultTemplateCopies = Object.freeze({
  [generalTemplateSlug]: defaultEnquiryCopy,
  "staff-invitation": defaultInvitationCopy,
  ...Object.fromEntries(serviceOptions.map(option => [option.slug, contextualCopy(option.label, "Thank you for your interest in " + option.label + ". We’ve received your enquiry and will be in touch about the next steps.")])),
  [packageTemplateSlug]: contextualCopy("Package", "Thank you for your interest in {{package}}. We’ve received your enquiry and will be in touch about your trip."),
  "enquiry-gift": contextualCopy("Travel gift", "Thank you for considering Travel With Ease for your gift. We’ll be in touch about the next steps."),
  "enquiry-group": contextualCopy("Group travel", "Thank you for your group travel enquiry. We’ll be in touch about planning for your group."),
  "enquiry-celebration": contextualCopy("Celebration", "Thank you for considering Travel With Ease for your celebration. We’ll be in touch about your plans."),
});
export function isTemplateSlug(slug) {
  return typeof slug === "string" && (Object.hasOwn(defaultTemplateCopies, slug) || packageTemplatePattern.test(slug));
}
export function packageTemplateOption(item) {
  const slug = "enquiry-package-" + item?.id;
  return packageTemplatePattern.test(slug) && typeof item.title === "string" && item.title.trim()
    ? { slug, label: item.title, automated: true, context: "package" } : null;
}
export function templateCandidates(enquiry = {}) {
  const details = enquiry.details || {};
  const candidates = [];
  if (enquiry.kind === "legacy_estimator") return [generalTemplateSlug];
  const specific = "enquiry-package-" + details.selectedPackageId;
  if (packageTemplatePattern.test(specific)) candidates.push(specific, packageTemplateSlug);
  else if (details.entryType === "package" || enquiry.kind === "package") candidates.push(packageTemplateSlug);
  const service = serviceOptions.find(item => item.serviceId === details.selectedServiceId);
  if (details.entryType === "service" && service) candidates.push(service.slug);
  const types = { gift: "enquiry-gift", group: "enquiry-group", celebration: "enquiry-celebration" };
  const type = Object.hasOwn(types, details.enquiryType) ? types[details.enquiryType] : null;
  if (type) candidates.push(type);
  if (service) candidates.push(service.slug);
  return [...new Set([...candidates, generalTemplateSlug])];
}
export function defaultCopyForTemplate(slug) {
  return defaultTemplateCopies[slug] || (packageTemplatePattern.test(slug) ? defaultTemplateCopies[packageTemplateSlug] : undefined);
}
export function renderEmailTemplate(slug, copy, packageLabel) {
  if (slug === "staff-invitation") return invitationTemplate({ copy });
  if (isTemplateSlug(slug)) return enquiryTemplate({ name: "Sample traveller", copy, context: { serviceTitle: serviceOptions.find(option => option.slug === slug)?.label || "Full Trip Planning", packageTitle: packageLabel || "Sample package" } });
  throw new Error("Unknown email template.");
}
