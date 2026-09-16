export const TELEGRAM_NAME_KEYWORD = "TurtleCC.cc";

export function hasRequiredTelegramName(
  firstName?: string | null,
  lastName?: string | null,
): boolean {
  const displayName = `${firstName ?? ""} ${lastName ?? ""}`.toLowerCase();
  return displayName.includes(TELEGRAM_NAME_KEYWORD.toLowerCase());
}