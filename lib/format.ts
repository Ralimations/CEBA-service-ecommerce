import { platform } from '@/config/platform';
export const money = (centavos: number) =>
  new Intl.NumberFormat(platform.locale, {
    style: 'currency',
    currency: platform.currency,
    maximumFractionDigits: 0,
  }).format(centavos / 100);
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: platform.timezone,
  }).format(new Date(date.length === 10 ? `${date}T00:00:00+08:00` : date));
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: platform.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export const human = (value: string) =>
  value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (s) => s.toUpperCase());
