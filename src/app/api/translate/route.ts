import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { text, targetLang } = await req.json();

    if (!text || !targetLang) {
      return NextResponse.json({ error: 'Missing text or targetLang' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const prompt = `Translate the following text to the language code '${targetLang}'. Return ONLY the translated text, nothing else, no quotes.\n\nText: ${text}`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[translate] Gemini API error:', errText);
      return NextResponse.json({ translated: text });
    }

    const data = await res.json();
    const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? text;

    return NextResponse.json({ translated });
  } catch (err) {
    console.error('[translate] Error:', err);
    // Graceful degradation — return original text
    return NextResponse.json({ translated: '' }, { status: 500 });
  }
}
