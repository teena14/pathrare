/**
 * Backward-compatible wrapper around react-i18next.
 * Components using useT('namespace') will now resolve keys via i18next
 * JSON locale files instead of the old static TS objects.
 *
 * Usage:  const t = useT('care_ai')  →  t('title')
 *         Equivalent to: const { t } = useTranslation(); t('care_ai.title')
 */
import { useTranslation } from 'react-i18next';

export function useT(namespace: string) {
  const { t } = useTranslation();
  return (key: string, options?: Record<string, unknown>): string => {
    return t(`${namespace}.${key}`, options ?? {}) as string;
  };
}
