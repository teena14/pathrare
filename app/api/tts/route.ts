import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured.' }, { status: 500 });
    }

    const { text } = await req.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'No text provided.' }, { status: 400 });
    }

    // Trim to 4096 chars max (OpenAI TTS limit)
    const trimmed = text.slice(0, 4096);

    const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: trimmed,
        voice: 'nova',   // Warm, clear female voice — good for medical context
        response_format: 'mp3',
        speed: 0.95,     // Slightly slower for medical content clarity
      }),
    });

    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      console.error('[tts] OpenAI TTS error:', err);
      return NextResponse.json({ error: 'TTS failed.' }, { status: 502 });
    }

    // Stream the audio back to the browser
    const audioBuffer = await ttsRes.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[tts]', error);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }
}
