export function isMissingTableError(error: { message?: string; code?: string } | null) {
  if (!error) return false;

  return (
    error.code === "42P01" ||
    error.message?.includes("Could not find the table") ||
    error.message?.includes("schema cache")
  );
}
