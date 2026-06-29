/**
 * Dynamic translation service for AI responses, community posts,
 * and other content that isn't covered by the static i18n JSON files.
 *
 * Caches results in localStorage to avoid redundant API calls.
 */

const CACHE_PREFIX = 'tx_cache_';

function buildCacheKey(text: string, targetLang: string): string {
  try {
    return CACHE_PREFIX + targetLang + '_' + btoa(unescape(encodeURIComponent(text))).slice(0, 40);
  } catch {
    // Fallback for very long strings or encoding issues
    return CACHE_PREFIX + targetLang + '_' + text.slice(0, 40).replace(/\W/g, '_');
  }
}

function getFromCache(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveToCache(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage quota exceeded or unavailable — ignore
  }
}

/**
 * Translate a single string to the target language.
 * Returns the original text if targetLang is 'en' or on failure.
 */
export async function translateText(
  text: string,
  targetLang: string
): Promise<string> {
  if (!text || !text.trim()) return text;
  if (targetLang === 'en') return text;

  const cacheKey = buildCacheKey(text, targetLang);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang }),
    });
    if (!res.ok) return text;
    const { translated } = await res.json();
    if (translated) {
      saveToCache(cacheKey, translated);
      return translated;
    }
    return text;
  } catch {
    // Graceful fallback to original text
    return text;
  }
}

/**
 * Translate multiple strings in parallel.
 */
export async function translateBatch(
  texts: string[],
  targetLang: string
): Promise<string[]> {
  return Promise.all(texts.map((t) => translateText(t, targetLang)));
}
