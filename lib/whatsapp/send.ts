import { normalizePhone } from "@/lib/phone";

type SendTextMessageInput = {
  to: string;
  body: string;
  connection: {
    phone_number_id: string | null;
    access_token_encrypted: string | null;
    is_connected: boolean;
  };
};

export function resolveWhatsappAccessToken(accessTokenEncrypted: string | null) {
  // TODO: Decrypt with a KMS-backed key before storing production tokens encrypted.
  return accessTokenEncrypted;
}

export async function sendWhatsAppTextMessage({
  to,
  body,
  connection,
}: SendTextMessageInput) {
  const accessToken = resolveWhatsappAccessToken(connection.access_token_encrypted);
  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v23.0";

  if (!connection.is_connected || !connection.phone_number_id || !accessToken) {
    return {
      ok: false,
      setupRequired: true,
      error: "Organization WhatsApp connection eksik veya bağlı değil.",
    };
  }

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${connection.phone_number_id}/messages`,
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
