import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';

// Map i18next language codes → Google Translate API language codes
const LANG_MAP: Record<string, string> = {
  en: 'en', hi: 'hi', ta: 'ta', mr: 'mr', te: 'te',
  bn: 'bn', kn: 'kn', gu: 'gu', pa: 'pa', or: 'or',
  ar: 'ar', fr: 'fr', es: 'es', zh: 'zh-CN', de: 'de', pt: 'pt',
};

export async function POST(req: NextRequest) {
  try {
    const { text, targetLang } = await req.json();

    if (!text || !targetLang) {
      return NextResponse.json({ error: 'Missing text or targetLang' }, { status: 400 });
    }

    const googleLang = LANG_MAP[targetLang] ?? targetLang;

    // Authenticate using the existing GCP service account credentials
    const authOptions: ConstructorParameters<typeof GoogleAuth>[0] = {
      scopes: ['https://www.googleapis.com/auth/cloud-translation'],
    };

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      authOptions.credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      authOptions.keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }

    const auth = new GoogleAuth(authOptions);
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();

    if (!token) {
      throw new Error('Failed to obtain GCP access token');
    }

    const translateRes = await fetch(
      'https://translation.googleapis.com/language/translate/v2',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          q: text,
          target: googleLang,
          format: 'text',
        }),
      }
    );

    if (!translateRes.ok) {
      const errBody = await translateRes.text();
      console.error('[translate] Google API error:', errBody);
      return NextResponse.json({ translated: text });
    }

    const data = await translateRes.json();
    const translated = data?.data?.translations?.[0]?.translatedText ?? text;

    return NextResponse.json({ translated });
  } catch (err) {
    console.error('[translate] Error:', err);
    // Graceful degradation — return original text
    return NextResponse.json({ translated: '' }, { status: 500 });
  }
}
