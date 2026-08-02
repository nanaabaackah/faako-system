import { parseMaintenancePayload } from "./maintenance.validation.js";

const id = (value) => { const parsed = Number(value); if (!Number.isInteger(parsed) || parsed <= 0) throw Object.assign(new Error("Maintenance window not found."), { status: 404 }); return parsed; };
export const createMaintenanceController = ({ maintenanceService }) => ({
  async list(req, res) { res.json({ maintenanceWindows: await maintenanceService.list(req.user) }); },
  async create(req, res) { res.status(201).json({ maintenanceWindow: await maintenanceService.create(parseMaintenancePayload(req.body), req.user) }); },
  async update(req, res) { res.json({ maintenanceWindow: await maintenanceService.update(id(req.params.id), parseMaintenancePayload(req.body, { partial: true }), req.user) }); },
  async cancel(req, res) { res.json({ maintenanceWindow: await maintenanceService.cancel(id(req.params.id), req.user) }); },
});
