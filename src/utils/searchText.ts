const DATE_QUERY_PATTERN = /^(\d{4})(?:(?:[-/.](\d{1,2})(?:[-/.](\d{1,2}))?)|(?:年(\d{1,2})月(?:(\d{1,2})日)?))?$/;

function canonicalizeDateToken(value: string): string {
  const match = value.match(DATE_QUERY_PATTERN);
  if (!match) return value;

  const [, year, separatedMonth, separatedDay, chineseMonth, chineseDay] = match;
  const month = separatedMonth ?? chineseMonth;
  const day = separatedDay ?? chineseDay;
  if (!month) return year;

  const numericMonth = Number(month);
  if (numericMonth < 1 || numericMonth > 12) return value;
  const canonicalMonth = `${year}-${String(numericMonth).padStart(2, '0')}`;
  if (!day) return canonicalMonth;

  const numericDay = Number(day);
  const daysInMonth = new Date(Number(year), numericMonth, 0).getDate();
  if (numericDay < 1 || numericDay > daysInMonth) return value;
  return `${canonicalMonth}-${String(numericDay).padStart(2, '0')}`;
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function tokenizeSearchQuery(query: string): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  return normalized.split(' ').map(canonicalizeDateToken);
}

export function buildSearchIndex(values: Array<string | null | undefined>): string {
  return normalizeSearchText(
    values.filter((value): value is string => Boolean(value?.trim())).join(' '),
  );
}

export function matchesSearchIndex(index: string, queryTokens: string[]): boolean {
  return queryTokens.length === 0 || queryTokens.every((token) => index.includes(token));
}
