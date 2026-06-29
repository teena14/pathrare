import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Groq API key not configured.' }, { status: 500 });
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    const lang = (formData.get('lang') as string | null) ?? 'en';

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided.' }, { status: 400 });
    }

    // Groq Whisper supports BCP-47 language codes
    const LANG_MAP: Record<string, string> = {
      en: 'en', hi: 'hi', ta: 'ta', mr: 'mr', te: 'te',
      bn: 'bn', kn: 'kn', gu: 'gu', pa: 'pa', or: 'or',
    };
    const whisperLang = LANG_MAP[lang] ?? 'en';

    // Groq's Whisper endpoint is OpenAI-compatible — just different base URL
    const openAIForm = new FormData();
    openAIForm.append('file', audioFile, audioFile.name || 'audio.webm');
    openAIForm.append('model', 'whisper-large-v3-turbo'); // Groq's fastest Whisper model
    openAIForm.append('language', whisperLang);
    openAIForm.append('response_format', 'json');

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: openAIForm,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.text();
      console.error('[stt] Groq Whisper error:', err);
      return NextResponse.json({ error: 'Transcription failed.' }, { status: 502 });
    }

    const result = await whisperRes.json();
    return NextResponse.json({ text: result.text ?? '' });
  } catch (error) {
    console.error('[stt]', error);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }
}
