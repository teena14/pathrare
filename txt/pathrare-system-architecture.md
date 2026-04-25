# PathRare System Architecture & Documentation

PathRare is an AI-powered health intelligence platform that transforms scattered patient medical records into structured, actionable clinical identities. It bridges the gap between complex diagnostic realities and practical care, allowing patients to verify diagnoses, maintain clinical profiles, and get matched with volunteer NGOs for support.

---

## 1. Complete Technology Stack

**Frontend**
- **Framework:** Next.js 15 (App Router)
- **Library:** React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS (with utility classes and custom color tokens like `primary-blue`, `dark-slate`, `emerald`, `amber`, etc.)
- **Animations:** Framer Motion (page transitions, micro-interactions)
- **Icons:** Lucide React (vector SVG icons)

**Backend & APIs**
- **Runtime:** Node.js (Next.js serverless functions / API routes)
- **Database:** Firebase Firestore (NoSQL document database)
- **File Storage:** Firebase Storage (for uploading raw patient medical documents/PDFs)
- **Authentication:** Firebase Auth (Context-based provider wrapper)

**AI & Machine Learning Infrastructure**
- **LLM Engine:** Google Gemini (`gemini-2.0-flash` / `gemini-1.5-flash`) via REST API.
- **Embeddings Model:** Google Vertex AI (`text-embedding-004`) via Google Auth Library.
- **Computer Vision / OCR:** Google Cloud Vision API (`DOCUMENT_TEXT_DETECTION`), `pdf-parse`, and Gemini Multimodal.

---

## 2. Core Features & User Flows

### A. Patient Dashboard & Clinical Profile
- **Clinical Profile Storage:** A persistent, tabbed interface (`app/patient/clinical-profile/page.tsx`) that segregates **AI Diagnoses** (JSON reports) from **Medical Documents** (raw PDFs).
- **CRUD Operations:** Patients can view, delete, and download their records. 
- **Shareable Links:** A secure `/share/[token]` route allows patients to generate read-only, time-limited links for doctors or caregivers to review their AI Reports and Documents.
- **Mismatch Triage:** When an AI diagnosis differs from a patient's stated diagnosis, an alert persists in their profile. Patients can choose to:
  1. *Change to AI Diagnosis* (Updates their primary user profile)
  2. *Keep Initial* (Dismisses the alert)
  3. *Skip for Later* (Leaves it for review)

### B. The Diagnostic Layer (AI Pipeline)
Located at `app/api/diagnose/route.ts`, this is the heart of PathRare. 

**1. Intelligent Document Processing (OCR)**
- A robust, 3-layer text extraction pipeline:
  - **PDFs:** Tries `pdf-parse` (fast local extraction) → Fallback to Gemini Multimodal (sends base64 inline).
  - **Images:** Tries Google Cloud Vision API → Fallback to Gemini Multimodal.
- Handles massive unstructured text chunks and plain-text typed symptoms.

**2. HPO (Human Phenotype Ontology) Integration**
- Loads the raw `hp.obo` dictionary and maps over 114,000 ORPHA-HPO associations.
- Scans the extracted text for exact or partial HPO string matches.
- Uses **Jaccard Similarity Scoring** to rank diseases based strictly on clinical phenotype evidence.

**3. Vertex AI Vector Embeddings**
- **Where are embeddings stored?** They are stored in a local JSON index file (`data/orphanet/parsed/index.json`) to allow lightning-fast, in-memory lookups without requiring a heavy Vector DB like Pinecone.
- Patient text is embedded dynamically using Vertex AI `text-embedding-004`.
- A custom mathematical Cosine Similarity function compares the patient's vector against the Orphanet disease embeddings.

**4. Gemini Multi-Pass Inference**
- After gathering the top HPO and Vector matches, the candidates are fed into a structured prompt.
- Gemini is instructed to act as a world-class geneticist. It reads the full OCR text, considers the candidate list, extracts a clean list of symptoms, and outputs a final confidence score.
- **Scoring Methodology:** 
  - 45% Gemini LLM (Reasoning)
  - 35% HPO Jaccard Similarity (Evidence)
  - 20% Vertex AI Vector Search (Semantic)

**5. Second Opinion Packs (SOP)**
- Dynamically generates beautiful HTML files (`SecondOpinionPack`) that patients can download directly to their devices. It includes the AI's clinical summary, exact HPO mappings, confidence scores, and ICD/OMIM codes.

### C. Life Assist & Care Layer
- **Life Assist:** Processes the patient's clinical situation to generate granular, actionable tasks broken into 4 categories: Clinical, Insurance, Home, and Care. 
- **Task Management:** Powered by Firestore, it deduplicates tasks and provides actionable steps.
- **Volunteer Matching:** Tasks are matched with NGO Volunteers. A real-time chat interface allows volunteers to help patients navigate their specific tasks (e.g., finding a specialist, applying for financial aid).
- **Care Protocols:** A dedicated `/care` tab designed to house 24/7 AI-guided care protocols.

### D. Volunteer / NGO Workflow
- Volunteers have their own ecosystem (`app/volunteer`).
- **Shared Header & Status:** Volunteers can toggle their availability status (Available, Busy, Offline).
- **Task Claiming:** They can view open patient requests/tasks, claim them, and initiate a secure chat (`lib/task-chat.ts`) to provide guidance based on the patient's Living Brief.

---

## 3. Data & Ontologies

PathRare does not guess medical data. It relies on internationally recognized clinical databases parsed and loaded locally:

- **Orphanet (`data/orphanet`)**: The gold-standard database for rare diseases. We parse their XMLs into lightweight JSON mappings (Alignments, Classifications, Phenotypes).
- **HPO (`hp.obo`)**: The Human Phenotype Ontology, which provides a standardized vocabulary of phenotypic abnormalities encountered in human disease.
- **ICD & OMIM**: Cross-referenced codes attached to every diagnostic match to ensure physicians can immediately plug the results into hospital systems.

---

## 4. Why This Architecture?

We specifically engineered the platform to be:
1. **Serverless & Edge-Ready:** By keeping the HPO mappings and Vector indexes in-memory (`route.ts` caching), we avoid network latency to external Vector DBs.
2. **Resilient:** The multi-layered OCR fallback ensures that if GCP Vision fails, Gemini steps in; if a PDF is protected, text extraction is bypassed elegantly with actionable error states.
3. **Professional:** Driven by an aesthetic using Lucide React icons, Framer Motion transitions, and modern Tailwind patterns to ensure patients feel a sense of trust and clarity in high-stress moments.
