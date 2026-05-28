export function normalizePhone(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");

  if (!digits) return "";
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;

  return digits;
}

export function phoneMatches(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const normalizedLeft = normalizePhone(left);
  const normalizedRight = normalizePhone(right);

  return Boolean(normalizedLeft && normalizedLeft === normalizedRight);
}
