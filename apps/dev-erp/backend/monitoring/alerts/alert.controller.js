import { parseAlertRulePayload, parseChannelPayload, parseEscalationPolicyPayload } from "./alert.validation.js";

const parseId = (value, label) => { const parsed = Number(value); if (!Number.isInteger(parsed) || parsed <= 0) throw Object.assign(new Error(`${label} not found.`), { status: 404 }); return parsed; };

export const createAlertController = ({ alertService, options, prisma, isGlobalAdmin }) => ({
  async responders(req, res) {
    const organizationWhere = isGlobalAdmin(req.user) ? {} : { organizationId: Number(req.user.organizationId) };
    const [users, roles] = await Promise.all([
      prisma.user.findMany({ where: { ...organizationWhere, status: "ACTIVE" }, select: { id: true, fullName: true, organizationId: true }, orderBy: { fullName: "asc" }, take: 200 }),
      prisma.role.findMany({ where: organizationWhere, select: { id: true, name: true, organizationId: true }, orderBy: { name: "asc" }, take: 100 }),
    ]);
    res.json({ users, roles });
  },
  async rules(req, res) { res.json({ alertRules: await alertService.listRules(req.user) }); },
  async createRule(req, res) { res.status(201).json({ alertRule: await alertService.createRule(parseAlertRulePayload(req.body), req.user) }); },
  async updateRule(req, res) { res.json({ alertRule: await alertService.updateRule(parseId(req.params.id, "Alert rule"), parseAlertRulePayload(req.body, { partial: true }), req.user) }); },
  async enableRule(req, res) { res.json({ alertRule: await alertService.setRuleEnabled(parseId(req.params.id, "Alert rule"), true, req.user) }); },
  async disableRule(req, res) { res.json({ alertRule: await alertService.setRuleEnabled(parseId(req.params.id, "Alert rule"), false, req.user) }); },
  async channels(req, res) { res.json({ channels: await alertService.listChannels(req.user), providerStatus: { whatsapp: options.whatsappEnabled ? "configured" : "disabled", webhook: options.webhookEnabled ? "configured" : "disabled" } }); },
  async createChannel(req, res) { res.status(201).json({ channel: await alertService.createChannel(parseChannelPayload(req.body, options), req.user) }); },
  async updateChannel(req, res) { res.json({ channel: await alertService.updateChannel(parseId(req.params.id, "Notification channel"), parseChannelPayload(req.body, { ...options, partial: true }), req.user) }); },
  async testChannel(req, res) { const incident = await prisma.monitoringIncident.findFirst({ where: isGlobalAdmin(req.user) ? {} : { organizationId: Number(req.user.organizationId) }, include: { service: true }, orderBy: { startedAt: "desc" } }); res.json(await alertService.testChannel(parseId(req.params.id, "Notification channel"), incident, req.user)); },
  async policies(req, res) { res.json({ escalationPolicies: await alertService.listPolicies(req.user) }); },
  async createPolicy(req, res) { res.status(201).json({ escalationPolicy: await alertService.createPolicy(parseEscalationPolicyPayload(req.body), req.user) }); },
  async updatePolicy(req, res) { res.json({ escalationPolicy: await alertService.updatePolicy(parseId(req.params.id, "Escalation policy"), parseEscalationPolicyPayload(req.body), req.user) }); },
  async notifications(req, res) {
    const userId = Number(req.user.userId) || -1; const organizationId = Number(req.user.organizationId) || -1;
    const where = isGlobalAdmin(req.user) ? { OR: [{ userId }, { userId: null, organizationId: null }] } : { OR: [{ userId }, { userId: null, organizationId }] };
    const [notifications, unreadCount] = await Promise.all([prisma.monitoringNotification.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }), prisma.monitoringNotification.count({ where: { ...where, readAt: null } })]);
    res.json({ notifications, unreadCount });
  },
  async readNotification(req, res) {
    const notificationId = parseId(req.params.id, "Notification"); const userId = Number(req.user.userId) || -1; const organizationId = Number(req.user.organizationId) || -1;
    const item = await prisma.monitoringNotification.findFirst({ where: { id: notificationId, ...(isGlobalAdmin(req.user) ? {} : { OR: [{ userId }, { userId: null, organizationId }] }) } });
    if (!item) throw Object.assign(new Error("Notification not found."), { status: 404 });
    res.json({ notification: await prisma.monitoringNotification.update({ where: { id: notificationId }, data: { readAt: new Date() } }) });
  },
});
