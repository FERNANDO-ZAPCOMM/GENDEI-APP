// Currency mapping by country
export const COUNTRY_TO_CURRENCY: Record<string, { code: string; locale: string }> = {
  Brazil: { code: 'BRL', locale: 'pt-BR' },
  Portugal: { code: 'EUR', locale: 'pt-PT' },
  'United States': { code: 'USD', locale: 'en-US' },
  Spain: { code: 'EUR', locale: 'es-ES' },
  Mexico: { code: 'MXN', locale: 'es-MX' },
  Argentina: { code: 'ARS', locale: 'es-AR' },
  Colombia: { code: 'COP', locale: 'es-CO' },
  Chile: { code: 'CLP', locale: 'es-CL' },
  Peru: { code: 'PEN', locale: 'es-PE' },
  'United Kingdom': { code: 'GBP', locale: 'en-GB' },
  Canada: { code: 'CAD', locale: 'en-CA' },
  Australia: { code: 'AUD', locale: 'en-AU' },
};

// Default fallback
const DEFAULT_CURRENCY = { code: 'USD', locale: 'en-US' };

/**
 * Get currency info based on country
 */
export function getCurrencyByCountry(country?: string): { code: string; locale: string } {
  if (!country) return DEFAULT_CURRENCY;
  return COUNTRY_TO_CURRENCY[country] || DEFAULT_CURRENCY;
}

/**
 * Format currency value with proper locale and currency code
 */
export function formatCurrency(
  amount: number,
  currencyCode?: string,
  locale?: string,
): string {
  const currency = currencyCode || DEFAULT_CURRENCY.code;
  const formatLocale = locale || DEFAULT_CURRENCY.locale;

  // Handle undefined, null, or NaN amounts
  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;

  return new Intl.NumberFormat(formatLocale, {
    style: 'currency',
    currency: currency,
  }).format(safeAmount);
}

/**
 * Create a currency formatter function for a specific currency
 */
export function createCurrencyFormatter(currencyCode?: string, locale?: string) {
  const currency = currencyCode || DEFAULT_CURRENCY.code;
  const formatLocale = locale || DEFAULT_CURRENCY.locale;

  const formatter = new Intl.NumberFormat(formatLocale, {
    style: 'currency',
    currency: currency,
  });

  return (amount: number) => formatter.format(amount);
}

/**
 * Get currency symbol for a currency code
 */
export function getCurrencySymbol(currencyCode: string, locale?: string): string {
  const formatLocale = locale || DEFAULT_CURRENCY.locale;

  const formatter = new Intl.NumberFormat(formatLocale, {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'narrowSymbol',
  });

  // Extract symbol from formatted zero
  const parts = formatter.formatToParts(0);
  const symbolPart = parts.find((part) => part.type === 'currency');
  return symbolPart?.value || currencyCode;
}

/**
 * Currency display names
 */
export const CURRENCY_NAMES: Record<string, string> = {
  BRL: 'Brazilian Real',
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar',
  MXN: 'Mexican Peso',
  ARS: 'Argentine Peso',
  COP: 'Colombian Peso',
  CLP: 'Chilean Peso',
  PEN: 'Peruvian Sol',
};

/**
 * Get currency name
 */
export function getCurrencyName(currencyCode: string): string {
  return CURRENCY_NAMES[currencyCode] || currencyCode;
}
