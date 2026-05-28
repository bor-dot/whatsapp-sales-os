export type MessageTemplate = {
  key: string;
  name: string;
  category: "confirmation" | "reminder" | "campaign" | "aftercare";
  body: string;
  variables: string[];
};

export const DEFAULT_MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    key: "appointment_confirmation",
    name: "Randevu Teyit",
    category: "confirmation",
    body: "Merhaba {{name}}, {{date}} tarihli randevunuzu teyit ediyoruz. Uygun değilse bize buradan yazabilirsiniz.",
    variables: ["name", "date"],
  },
  {
    key: "appointment_reminder",
    name: "Randevu Hatırlatma",
    category: "reminder",
    body: "Merhaba {{name}}, randevunuz yarın {{time}} saatinde. Sizi bekliyoruz.",
    variables: ["name", "time"],
  },
  {
    key: "campaign",
    name: "Kampanya Mesajı",
    category: "campaign",
    body: "Merhaba {{name}}, {{service}} için bu haftaya özel kampanyamız var. Detay ister misiniz?",
    variables: ["name", "service"],
  },
  {
    key: "aftercare",
    name: "İşlem Sonrası",
    category: "aftercare",
    body: "Merhaba {{name}}, işlem sonrası memnuniyetinizi merak ediyoruz. Herhangi bir sorunuz olursa buradan yazabilirsiniz.",
    variables: ["name"],
  },
];

export function renderTemplate(body: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    body,
  );
}
