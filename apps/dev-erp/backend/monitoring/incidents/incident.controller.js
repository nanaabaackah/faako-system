import { parseAssignmentPayload, parseExportFormat, parseIncidentFilters, parseIncidentId, parseIncidentUpdatePayload, parseNotePayload, parseResolutionPayload } from "./incident.validation.js";

const idOr404 = (value) => {
  const id = parseIncidentId(value);
  if (!id) throw Object.assign(new Error("Incident not found."), { status: 404 });
  return id;
};

export const createIncidentController = ({ incidentService }) => ({
  async list(req, res) { res.json({ incidents: await incidentService.list(parseIncidentFilters(req.query), req.user) }); },
  async get(req, res) { res.json({ incident: await incidentService.get(idOr404(req.params.id), req.user) }); },
  async acknowledge(req, res) { res.json({ incident: await incidentService.acknowledge(idOr404(req.params.id), req.user) }); },
  async assign(req, res) { res.json({ incident: await incidentService.assign(idOr404(req.params.id), parseAssignmentPayload(req.body), req.user) }); },
  async note(req, res) { const { note } = parseNotePayload(req.body); res.status(201).json({ incident: await incidentService.addNote(idOr404(req.params.id), note, req.user) }); },
  async update(req, res) { res.json({ incident: await incidentService.update(idOr404(req.params.id), parseIncidentUpdatePayload(req.body), req.user) }); },
  async resolve(req, res) { res.json({ incident: await incidentService.resolve(idOr404(req.params.id), parseResolutionPayload(req.body), req.user) }); },
  async close(req, res) { res.json({ incident: await incidentService.close(idOr404(req.params.id), req.user) }); },
  async reopen(req, res) { const { note } = parseNotePayload(req.body); res.json({ incident: await incidentService.reopen(idOr404(req.params.id), note, req.user) }); },
  async timeline(req, res) { res.json({ timeline: await incidentService.timeline(idOr404(req.params.id), req.user) }); },
  async export(req, res) { const result = await incidentService.export(idOr404(req.params.id), parseExportFormat(req.query.format), req.user); res.setHeader("Content-Type", result.contentType); res.setHeader("Content-Disposition", `attachment; filename=incident-${req.params.id}.${result.extension}`); res.send(result.body); },
});
