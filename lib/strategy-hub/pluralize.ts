/**
 * Polska odmiana liczebnikowa: `plural(3, "luka", "luki", "luk")` → "luki".
 * `pluralCount` zwraca od razu "3 luki".
 */
function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  const d10 = abs % 10;
  const d100 = abs % 100;
  if (d10 >= 2 && d10 <= 4 && !(d100 >= 12 && d100 <= 14)) return few;
  return many;
}

export function pluralCount(
  n: number,
  one: string,
  few: string,
  many: string
): string {
  return `${n} ${plural(n, one, few, many)}`;
}
