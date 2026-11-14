export const MEETING_PROVIDERS = Object.freeze({
  GOOGLE_MEET: "Google Meet",
  ZOOM: "Zoom",
  WHATSAPP: "WhatsApp",
  FACETIME: "FaceTime",
});
export const isMeetingProvider = (value) => Object.hasOwn(MEETING_PROVIDERS, value);

export const validateMeetingLink = (provider, rawLink) => {
  if (!isMeetingProvider(provider)) return { ok: false, error: "Choose a supported meeting platform." };
  if (typeof rawLink !== "string" || !rawLink.trim() || rawLink.length > 2000) {
    return { ok: false, error: "A meeting link is required (maximum 2000 characters)." };
  }
  try {
    const link = new URL(rawLink.trim());
    if (link.protocol !== "https:" || link.username || link.password) {
      return { ok: false, error: "Use a secure HTTPS meeting link." };
    }
    const hostname = link.hostname.toLowerCase();
    const validHostname = provider === "GOOGLE_MEET"
      ? hostname === "meet.google.com"
      : provider === "ZOOM"
        ? hostname === "zoom.us" || hostname.endsWith(".zoom.us")
        : provider === "WHATSAPP"
          ? hostname === "call.whatsapp.com"
          : hostname === "facetime.apple.com";
    if (!validHostname) return { ok: false, error: "The meeting URL does not match the chosen provider." };
    return { ok: true, url: link.toString() };
  } catch {
    return { ok: false, error: "Enter a valid meeting link." };
  }
};

export const meetingLinkState = (booking) => {
  if (!booking?.meetingLink) return "PENDING_LINK";
  return booking.meetingLinkDeliveryStatus === "SENT" ? "SENT" : "READY";
};
