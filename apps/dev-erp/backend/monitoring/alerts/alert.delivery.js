import { sanitizeText } from "../monitoring.security.js";

const safeError = (error) => {
  const code = sanitizeText(error?.code || error?.name, 40);
  return code && code !== "Error" ? `Notification provider failed (${code}).` : "Notification provider failed.";
};
const escapeHtml = (value) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const createAlertDelivery = ({ prisma, channelCrypto, sendEmail, options = {} }) => {
  const decodeConfig = (channel) => {
    if (!channel.encryptedConfig) return {};
    if (!channelCrypto) throw new Error("Monitoring channel encryption is not configured.");
    return JSON.parse(channelCrypto.decrypt(channel.encryptedConfig));
  };

  const deliver = async ({ event, channel, incident }) => {
    if (!channel?.enabled) return { status: "SKIPPED", errorSummary: "Notification channel is disabled." };
    if (channel.type === "IN_APP") {
      await prisma.monitoringNotification.create({ data: { organizationId: incident.organizationId, incidentId: incident.id, type: event.eventType, title: `${incident.severity} incident: ${incident.title || incident.summary}`, message: sanitizeText(event.safeSummary || incident.summary, 300) || "Monitoring incident updated.", link: `/system-health?incident=${incident.id}` } });
      return { status: "SENT" };
    }
    if (channel.type === "EMAIL") {
      const config = decodeConfig(channel);
      if (!Array.isArray(config.recipients) || !config.recipients.length) return { status: "SKIPPED", errorSummary: "Email recipients are not configured." };
      await sendEmail({ fromEmail: options.emailFrom, fromName: "Dev ERP Monitoring", recipients: config.recipients, replyTo: options.emailReplyTo, subject: `[${incident.severity}] ${sanitizeText(incident.title || incident.summary, 180)}`, text: `${event.safeSummary || incident.summary}\n\nIncident: ${incident.id}\nStatus: ${incident.status}\nService: ${incident.service?.name || incident.serviceId}\nOpen Dev ERP: ${options.appBaseUrl || ""}/system-health?incident=${incident.id}`.trim(), html: `<p><strong>${escapeHtml(sanitizeText(event.safeSummary || incident.summary, 300))}</strong></p><p>Incident #${incident.id} · ${escapeHtml(incident.status)} · ${escapeHtml(incident.service?.name || "Monitored service")}</p>` });
      return { status: "SENT" };
    }
    return { status: "SKIPPED", errorSummary: `${channel.type} delivery is disabled until an approved provider is configured.` };
  };

  return {
    async deliverEvent(event, channel, incident) {
      try {
        const result = await deliver({ event, channel, incident });
        return prisma.alertEvent.update({ where: { id: event.id }, data: { deliveryStatus: result.status, deliveredAt: result.status === "SENT" ? new Date() : null, attemptCount: { increment: 1 }, errorSummary: result.errorSummary || null } });
      } catch (error) {
        const attemptCount = event.attemptCount + 1;
        const exhausted = attemptCount >= options.maxRetries;
        return prisma.alertEvent.update({ where: { id: event.id }, data: { deliveryStatus: exhausted ? "FAILED" : "PENDING", attemptCount, nextAttemptAt: exhausted ? null : new Date(Date.now() + options.retryDelayMs * attemptCount), errorSummary: safeError(error) } });
      }
    },
    decodeConfig,
  };
};
