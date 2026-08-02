import { sanitizeText } from "../monitoring.security.js";

const safeChannel = (channel) => {
  const safe = { ...channel };
  delete safe.encryptedConfig;
  return safe;
};

export const createAlertAdministrationService = ({ prisma, channelCrypto, options, auditWriter, delivery, isGlobalAdmin }) => {
  const scope = (user) => isGlobalAdmin(user) ? {} : { organizationId: Number(user.organizationId) };
  const audit = (action, targetType, targetId, user) => auditWriter?.({ organizationId: user.organizationId, userId: user.userId, action, targetType, targetId: String(targetId), actorLabel: user.email, source: "api", category: "admin" });
  const validateRuleReferences = async (data, user) => {
    if (data.channelIds?.length) {
      const count = await prisma.monitoringNotificationChannel.count({ where: { id: { in: data.channelIds }, ...scope(user), enabled: true } });
      if (count !== data.channelIds.length) throw Object.assign(new Error("One or more notification channels are not authorized."), { status: 400 });
    }
    if (data.escalationPolicyId) {
      const policy = await prisma.escalationPolicy.findFirst({ where: { id: data.escalationPolicyId, ...scope(user), enabled: true }, select: { id: true } });
      if (!policy) throw Object.assign(new Error("Escalation policy is not authorized."), { status: 400 });
    }
  };
  const validateEscalationSteps = async (steps, user) => {
    for (const step of steps) {
      if (step.targetType === "USER" && !await prisma.user.findFirst({ where: { id: step.targetUserId, status: "ACTIVE", ...scope(user) }, select: { id: true } })) throw Object.assign(new Error("Escalation user is not authorized."), { status: 400 });
      if (step.targetType === "ROLE" && !await prisma.role.findFirst({ where: { id: step.targetRoleId, ...scope(user) }, select: { id: true } })) throw Object.assign(new Error("Escalation role is not authorized."), { status: 400 });
      if (step.targetType === "CHANNEL" && !await prisma.monitoringNotificationChannel.findFirst({ where: { id: step.targetChannelId, enabled: true, ...scope(user) }, select: { id: true } })) throw Object.assign(new Error("Escalation channel is not authorized."), { status: 400 });
    }
  };
  return {
    listRules: (user) => prisma.alertRule.findMany({ where: scope(user), include: { service: { select: { id: true, name: true } }, channels: { include: { channel: { select: { id: true, name: true, type: true, enabled: true, safeDisplay: true } } } }, escalationPolicy: { select: { id: true, name: true } } }, orderBy: { name: "asc" } }),
    async createRule(data, user) {
      await validateRuleReferences(data, user);
      const { channelIds = [], ...ruleData } = data;
      const organizationId = isGlobalAdmin(user) && user.requestedOrganizationId === null ? null : Number(user.organizationId);
      const rule = await prisma.alertRule.create({ data: { ...ruleData, organizationId, createdByUserId: Number(user.userId) || null, channels: channelIds.length ? { create: channelIds.map((channelId) => ({ channelId })) } : undefined }, include: { channels: true } });
      await audit("MONITORING_ALERT_RULE_CREATED", "AlertRule", rule.id, user); return rule;
    },
    async updateRule(id, data, user) {
      const existing = await prisma.alertRule.findFirst({ where: { id, ...scope(user) } }); if (!existing) throw Object.assign(new Error("Alert rule not found."), { status: 404 });
      await validateRuleReferences(data, user);
      const { channelIds, ...ruleData } = data;
      const rule = await prisma.alertRule.update({ where: { id }, data: { ...ruleData, ...(channelIds ? { channels: { deleteMany: {}, create: channelIds.map((channelId) => ({ channelId })) } } : {}) } });
      await audit("MONITORING_ALERT_RULE_UPDATED", "AlertRule", id, user); return rule;
    },
    async setRuleEnabled(id, enabled, user) { return this.updateRule(id, { enabled }, user); },
    async listChannels(user) { return (await prisma.monitoringNotificationChannel.findMany({ where: scope(user), orderBy: { name: "asc" } })).map(safeChannel); },
    async createChannel(data, user) {
      if (data.type !== "IN_APP" && !channelCrypto) throw Object.assign(new Error("Monitoring channel encryption is not configured."), { status: 503 });
      const encryptedConfig = data.type === "IN_APP" ? null : channelCrypto.encrypt(JSON.stringify(data.config || {}));
      const channel = await prisma.monitoringNotificationChannel.create({ data: { organizationId: isGlobalAdmin(user) ? null : Number(user.organizationId), name: data.name, type: data.type, enabled: data.enabled ?? true, safeDisplay: data.safeDisplay, encryptedConfig, createdByUserId: Number(user.userId) || null } });
      await audit("MONITORING_CHANNEL_CREATED", "MonitoringNotificationChannel", channel.id, user); return safeChannel(channel);
    },
    async updateChannel(id, data, user) {
      const existing = await prisma.monitoringNotificationChannel.findFirst({ where: { id, ...scope(user) } }); if (!existing) throw Object.assign(new Error("Notification channel not found."), { status: 404 });
      const encryptedConfig = data.config ? channelCrypto?.encrypt(JSON.stringify(data.config)) : undefined;
      const channel = await prisma.monitoringNotificationChannel.update({ where: { id }, data: { name: data.name, enabled: data.enabled, safeDisplay: data.safeDisplay, encryptedConfig } });
      await audit("MONITORING_CHANNEL_UPDATED", "MonitoringNotificationChannel", id, user); return safeChannel(channel);
    },
    async testChannel(id, incident, user) {
      const channel = await prisma.monitoringNotificationChannel.findFirst({ where: { id, ...scope(user) } }); if (!channel) throw Object.assign(new Error("Notification channel not found."), { status: 404 });
      const safeIncident = incident || { id: 0, organizationId: channel.organizationId, severity: "INFO", status: "OPEN", title: "Monitoring channel test", summary: "This is a Dev ERP monitoring channel test.", service: { name: "Dev ERP monitoring" } };
      const event = await prisma.alertEvent.findFirst({ where: { channelId: id }, orderBy: { createdAt: "desc" } });
      if (!event) throw Object.assign(new Error("Channel testing requires an existing safe alert event."), { status: 409 });
      const result = await delivery.deliverEvent(event, channel, safeIncident); await audit("MONITORING_CHANNEL_TESTED", "MonitoringNotificationChannel", id, user); return { status: result.deliveryStatus, errorSummary: sanitizeText(result.errorSummary, 180) };
    },
    async listPolicies(user) { return prisma.escalationPolicy.findMany({ where: scope(user), include: { steps: { orderBy: { position: "asc" } } }, orderBy: { name: "asc" } }); },
    async createPolicy(data, user) { const { steps, ...policy } = data; await validateEscalationSteps(steps, user); const created = await prisma.escalationPolicy.create({ data: { ...policy, organizationId: isGlobalAdmin(user) ? null : Number(user.organizationId), createdByUserId: Number(user.userId) || null, steps: { create: steps } }, include: { steps: true } }); await audit("MONITORING_ESCALATION_POLICY_CREATED", "EscalationPolicy", created.id, user); return created; },
    async updatePolicy(id, data, user) { const existing = await prisma.escalationPolicy.findFirst({ where: { id, ...scope(user) } }); if (!existing) throw Object.assign(new Error("Escalation policy not found."), { status: 404 }); const { steps, ...policy } = data; await validateEscalationSteps(steps, user); const updated = await prisma.escalationPolicy.update({ where: { id }, data: { ...policy, steps: { deleteMany: {}, create: steps } }, include: { steps: true } }); await audit("MONITORING_ESCALATION_POLICY_UPDATED", "EscalationPolicy", id, user); return updated; },
    options,
  };
};
