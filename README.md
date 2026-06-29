# PathRare

PathRare is an advanced AI-powered diagnostic engine that matches patient symptoms and clinical documents to rare diseases using semantic search, HPO ontology, and Gemini LLMs.

## Deployment to Vercel

This application is fully compatible with Vercel and requires zero Google Cloud Platform (GCP) billing dependencies.

1. **Create a project on Vercel**: Connect your GitHub repository.
2. **Environment Variables**: Add the variables from `.env.example` into your Vercel project settings. You can obtain a free Gemini API key from [Google AI Studio](https://aistudio.google.com/).
3. **Deploy**: Vercel will automatically build and deploy your Next.js application. 

## Local Development

1. Run `npm install`
2. Copy `.env.example` to `.env.local` and populate the keys.
3. Start the dev server: `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000)

## Architecture

- **Frontend**: Next.js (App Router), React, Tailwind CSS, Framer Motion
- **OCR**: Tesseract.js (WASM-based, runs in-memory without GCP Vision API)
- **Embedding / LLM**: Gemini API (replaces Vertex AI)
- **Search Engine**: In-memory vector search over generated embeddings

