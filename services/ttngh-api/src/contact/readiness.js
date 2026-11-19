// Enquiry storage must not take down the TTNGH public API.
// Only return ready after the dedicated contact tables are queryable.
const reasonFor = error => {
  switch (error?.code) {
    case "42P01": return "migration_missing";
    case "42501": return "permission_denied";
    case "28P01": return "authentication_failed";
    case "3D000": return "database_missing";
    case "ENOTFOUND": return "database_host_unavailable";
    case "ECONNREFUSED": return "connection_refused";
    case "ETIMEDOUT": return "connection_timeout";
    default: return "database_unavailable";
  }
};

export function createEnquiryReadiness(pool, logger = console) {
  let ready = false;
  let checked = false;
  return {
    isReady: () => ready,
    async refresh() {
      if (!pool) return false;
      try {
        // Confirm both required relations exist; do not fetch private data.
        await pool.query("SELECT id FROM ttngh_contact.enquiries LIMIT 0");
        await pool.query("SELECT id FROM ttngh_contact.notification_outbox LIMIT 0");
        if (!ready) logger.info?.("TTNGH enquiry storage ready");
        ready = true;
      } catch (error) {
        if (ready || !checked) logger.warn?.(`TTNGH enquiry storage unavailable: ${reasonFor(error)}`);
        ready = false;
      }
      checked = true;
      return ready;
    }
  };
}
