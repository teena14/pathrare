$gcloud = "C:\Users\User\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"

$requiredKeys = @(
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
    "GCP_PROJECT_ID",
    "GCP_LOCATION",
    "NEXT_PUBLIC_APP_URL"
)

$envMap = @{}
Get-Content .env.local |
    Where-Object { $_ -match '=' -and $_ -notmatch '^\s*#' } |
    ForEach-Object {
        $parts = $_.Split('=', 2)
        $key = $parts[0].Trim()
        $value = $parts[1].Trim().Trim('"').Trim("'")
        $envMap[$key] = $value
    }

$missingKeys = $requiredKeys | Where-Object { -not $envMap.ContainsKey($_) -or [string]::IsNullOrWhiteSpace($envMap[$_]) }
if ($missingKeys.Count -gt 0) {
    Write-Error ("Missing required .env.local keys: " + ($missingKeys -join ", "))
    exit 1
}

$projectId = $envMap["GCP_PROJECT_ID"]
$substitutions = @(
    "_NEXT_PUBLIC_FIREBASE_API_KEY=$($envMap["NEXT_PUBLIC_FIREBASE_API_KEY"])",
    "_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$($envMap["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"])",
    "_NEXT_PUBLIC_FIREBASE_PROJECT_ID=$($envMap["NEXT_PUBLIC_FIREBASE_PROJECT_ID"])",
    "_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$($envMap["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"])",
    "_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$($envMap["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"])",
    "_NEXT_PUBLIC_FIREBASE_APP_ID=$($envMap["NEXT_PUBLIC_FIREBASE_APP_ID"])",
    "_NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=$($envMap["NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"])",
    "_GCP_PROJECT_ID=$($envMap["GCP_PROJECT_ID"])",
    "_GCP_LOCATION=$($envMap["GCP_LOCATION"])",
    "_NEXT_PUBLIC_APP_URL=$($envMap["NEXT_PUBLIC_APP_URL"])"
) -join ","

Write-Host "Submitting Cloud Build for PathRare..." -ForegroundColor Green
Write-Host "Project: $projectId" -ForegroundColor Cyan
Write-Host "This build will compile the Next.js app, push the container image, and deploy Cloud Run." -ForegroundColor Cyan

& $gcloud builds submit `
    --config cloudbuild.yaml `
    --substitutions "$substitutions" `
    --project $projectId
