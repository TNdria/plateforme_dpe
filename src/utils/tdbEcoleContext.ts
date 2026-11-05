/** School-level counts express presence, not an aggregate percentage. */
export function schoolPresence(value: unknown): 'OUI' | 'NON' | '-' {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'OUI' : 'NON';
  if (typeof value === 'string') {
    const text = value.trim().toUpperCase();
    if (text === 'OUI' || text === 'NON') return text;
    if (!text) return '-';
  }
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? (count > 0 ? 'OUI' : 'NON') : '-';
}