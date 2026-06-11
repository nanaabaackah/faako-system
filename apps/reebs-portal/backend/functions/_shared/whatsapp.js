const normalizePhone = (value) => (typeof value === "string" ? value.replace(/\D/g, "") : "");

export const sendManagerWhatsApp = async ({ lines = [], text = "" }) => {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const managerPhone = process.env.WHATSAPP_MANAGER_PHONE;
  if (!accessToken || !phoneNumberId || !managerPhone || typeof fetch !== "function") {
    return;
  }

  const to = normalizePhone(managerPhone);
  if (!to) return;

  const body = text || lines.filter(Boolean).join("\n");
  if (!body) return;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  };

  const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.warn("WhatsApp notify failed:", response.status, errorText);
  }
};
