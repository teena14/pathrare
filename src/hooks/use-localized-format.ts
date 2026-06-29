import { useLang } from '@/providers/language-provider';
import { useCallback } from 'react';

export function useLocalizedFormat() {
  const { lang } = useLang();

  const formatDate = useCallback((date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
    try {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) return String(date);
      return new Intl.DateTimeFormat(lang, options || { dateStyle: 'medium' }).format(d);
    } catch (e) {
      return String(date);
    }
  }, [lang]);

  const formatNumber = useCallback((number: number, options?: Intl.NumberFormatOptions) => {
    try {
      return new Intl.NumberFormat(lang, options).format(number);
    } catch (e) {
      return String(number);
    }
  }, [lang]);
  
  const formatCurrency = useCallback((amount: number, currency: string = 'USD') => {
    try {
      return new Intl.NumberFormat(lang, { style: 'currency', currency }).format(amount);
    } catch (e) {
      return String(amount);
    }
  }, [lang]);

  const formatRelativeTime = useCallback((value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'just now'; // simple fallback
    }

    const diffDays = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
    
    try {
      const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
      if (diffDays === 0) return rtf.format(0, 'day');
      if (diffDays < 30) return rtf.format(-diffDays, 'day');
      return 'over 30 days ago';
    } catch (e) {
      if (diffDays === 0) return 'today';
      if (diffDays === 1) return '1 day ago';
      if (diffDays < 30) return `${diffDays} days ago`;
      return 'over 30 days ago';
    }
  }, [lang]);

  return { formatDate, formatNumber, formatCurrency, formatRelativeTime };
}
