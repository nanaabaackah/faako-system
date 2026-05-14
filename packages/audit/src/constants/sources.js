export const AUDIT_SOURCES = Object.freeze({
  ONLINE: "online",
  OFFLINE_SYNC: "offline_sync",
  SYSTEM: "system",
});

export const AUDIT_SOURCE_LABELS = Object.freeze({
  [AUDIT_SOURCES.ONLINE]: "Online",
  [AUDIT_SOURCES.OFFLINE_SYNC]: "Offline sync",
  [AUDIT_SOURCES.SYSTEM]: "System",
});
