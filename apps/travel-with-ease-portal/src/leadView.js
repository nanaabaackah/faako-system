export const toLeadRow = (lead) => ({
  id: lead.id,
  name: lead.contact?.name || "Unknown traveller",
  destination: lead.inquiry?.destination || "Not specified",
  timing: lead.inquiry?.travelDate || "Not set",
  party: `${lead.inquiry?.travellers || 0} traveller${lead.inquiry?.travellers === 1 ? "" : "s"}`,
  stage: String(lead.stage || "new").replaceAll("_", " "),
  received: new Date(lead.createdAt).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" }),
});
