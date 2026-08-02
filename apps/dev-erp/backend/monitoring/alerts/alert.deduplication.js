export const buildAlertDeduplicationKey = ({ ruleId, serviceId, incidentId = "none", eventType, channelId = "none", bucket = null }) => [ruleId, serviceId, incidentId, eventType, channelId, bucket].filter((value) => value !== null).join(":");

export const getCooldownBucket = (date = new Date(), cooldownMinutes = 15) => Math.floor(new Date(date).getTime() / (Math.max(1, cooldownMinutes) * 60_000));

export const shouldCreateRepeatedEvent = ({ latestEvent, now = new Date(), cooldownMinutes = 15 }) => !latestEvent || new Date(now).getTime() - new Date(latestEvent.createdAt).getTime() >= cooldownMinutes * 60_000;
