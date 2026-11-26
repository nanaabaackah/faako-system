// Map only already-authorised destinations. This never grants permissions.
const definitions = [
  ["overview", "Overview", "overview", [["overview", "Overview"]]],
  ["enquiries", "Enquiries", "enquiries", [["enquiries", "All enquiries"], ["forms", "Enquiry forms"], ["questionnaire", "Detailed questionnaire"]]],
  ["website", "Website", "content", [["content", "Website content"], ["appearance", "Brand & appearance"]]],
  ["media", "Media", "media", [["media", "Media library"]]],
  ["communications", "Communications", "templates", [["templates", "Email templates"]]],
  ["administration", "Administration", "staff", [["staff", "Staff access"], ["activity", "Activity"], ["system", "System administration"]]],
];
export function getPortalModules(navigation) {
  const allowed = new Set(navigation.map(([id]) => id));
  return definitions.map(([id,label,iconKey,children]) => ({
    id, label, iconKey, path: "/" + id,
    children: children.filter(([childId]) => allowed.has(childId)).map(([childId,childLabel]) => ({ id: childId, label: childLabel })),
  })).filter(module => module.children.length);
}
