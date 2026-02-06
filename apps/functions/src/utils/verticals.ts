// Gendei Vertical Utilities
// Composite clinic ID helpers for multi-vertical support

const VALID_VERTICALS = new Set([
  'med', 'dental', 'psi', 'nutri', 'fisio',
  'dermato', 'oftalmo', 'pediatra', 'fono', 'estetica', 'geral',
]);

export function isValidVertical(slug: string): boolean {
  return VALID_VERTICALS.has(slug);
}

export function buildCompositeClinicId(userId: string, vertical: string): string {
  return `${userId}_${vertical}`;
}

export function parseCompositeClinicId(compositeId: string): { userId: string; vertical: string } | null {
  const lastUnderscore = compositeId.lastIndexOf('_');
  if (lastUnderscore === -1) return null;
  const vertical = compositeId.substring(lastUnderscore + 1);
  if (!isValidVertical(vertical)) return null;
  return { userId: compositeId.substring(0, lastUnderscore), vertical };
}
