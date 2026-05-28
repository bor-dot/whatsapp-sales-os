import { normalizePhone } from "@/lib/phone";

type SendTextMessageInput = {
  to: string;
  body: string;
};

export async function sendWhatsAppTextMessage({ to, body }: SendTextMessageInput) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION;

  if (!accessToken || !phoneNumberId || !graphVersion) {
    return {
      ok: false,
      setupRequired: true,
      error: "WhatsApp API env eksik.",
    };
  }

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "text",
        text: {
          body,
          preview_url: false,
        },
      }),
    },
  );

  const data = await response.json().catch(() => null);

  return {
    ok: response.ok,
    setupRequired: false,
    status: response.status,
    data,
    error: response.ok ? null : "WhatsApp API gönderimi başarısız.",
  };
}
