# PathRare on Google Cloud Run

This app is a Next.js 16 server app with Firebase, Firestore, Gemini, Vertex AI, and OCR endpoints.

The repo is now set up so Cloud Run can use its attached service account for Google Cloud access. That means you do not need to ship `credentials/gcp-service-account.json` into production.

## 1. Create or pick a Google Cloud project

Use the same project as your Firebase project if possible.

Example:

```powershell
gcloud config set project YOUR_PROJECT_ID
```

## 2. Enable the required APIs

```powershell
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com aiplatform.googleapis.com vision.googleapis.com firestore.googleapis.com
```

## 3. Create the Cloud Run runtime service account

```powershell
gcloud iam service-accounts create pathrare-runner --display-name="PathRare Cloud Run"
```

Grant the minimum roles this app needs:

```powershell
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID --member="serviceAccount:pathrare-runner@YOUR_PROJECT_ID.iam.gserviceaccount.com" --role="roles/datastore.user"
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID --member="serviceAccount:pathrare-runner@YOUR_PROJECT_ID.iam.gserviceaccount.com" --role="roles/aiplatform.user"
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID --member="serviceAccount:pathrare-runner@YOUR_PROJECT_ID.iam.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
```

`roles/datastore.user` is for Firestore via Firebase Admin.

`roles/aiplatform.user` is for Vertex AI embedding calls.

If you want Google Vision OCR in production, also enable Vision API access for the service account in your org's IAM model. If not, the app falls back to Gemini OCR for images and `pdf-parse` for PDFs.

## 4. Put the runtime secret in Secret Manager

Create the Gemini API key secret:

```powershell
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
```

If the secret already exists, add a new version instead:

```powershell
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add gemini-api-key --data-file=-
```

## 5. Update `.env.local`

Make sure these keys exist locally before deploying:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
GCP_PROJECT_ID
GCP_LOCATION
NEXT_PUBLIC_APP_URL
```

Notes:

- The `NEXT_PUBLIC_FIREBASE_*` values are build-time values for the browser bundle.
- `GCP_PROJECT_ID` and `GCP_LOCATION` are runtime server values.
- `NEXT_PUBLIC_APP_URL` should be your final public Cloud Run URL or custom domain.
- `GEMINI_API_KEY` should live in Secret Manager as `gemini-api-key` for Cloud Run.
- `GOOGLE_APPLICATION_CREDENTIALS` is optional locally and should usually be omitted on Cloud Run.
- `FIREBASE_ADMIN_*` values are now optional if Cloud Run uses the attached service account.

## 6. First deployment

Deploy once with the helper script:

```powershell
.\deploy.ps1
```

What it does:

1. Reads the required values from `.env.local`
2. Sends the `NEXT_PUBLIC_*` Firebase values to Docker build args
3. Runs `cloudbuild.yaml`
4. Builds the container
5. Pushes the image
6. Deploys `pathrare-app` to Cloud Run

## 7. Set the final public base URL

After Cloud Run gives you the service URL, update the public base URL if needed:

```powershell
gcloud run services update pathrare-app `
  --region us-central1 `
  --update-env-vars NEXT_PUBLIC_APP_URL=https://YOUR_CLOUD_RUN_URL
```

## 8. Verify the deployment

Check the service:

```powershell
gcloud run services describe pathrare-app --region us-central1
```

Open the URL and test:

- Login and Firebase client initialization
- `/api/diagnose`
- `/api/ask`
- report save/read flows
- document save/delete flows
- share-link generation

## 9. Future deploys

For code-only updates:

```powershell
.\deploy.ps1
```

If only runtime config changes, update the Cloud Run service instead of rebuilding:

```powershell
gcloud run services update pathrare-app --region us-central1 --update-env-vars KEY=VALUE
```

## 10. Important repo-specific notes

- The Dockerfile now accepts Firebase `NEXT_PUBLIC_*` values as Docker build args, which is required for Next.js client bundles.
- The app now supports Application Default Credentials on Cloud Run for Vertex AI, Vision, and shared Firebase Admin access.
- `npm run build` compiled successfully, and `npx tsc --noEmit` passed locally. The full Next build ended with a Windows `spawn EPERM` after compilation in this environment, so Cloud Build is the right place to do the production build.
