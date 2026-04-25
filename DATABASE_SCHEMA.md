# Database Schema for Clinical Profile & Reports

## Collections

### 1. `reports/{reportId}`

Stores each diagnostic report with AI analysis.

```typescript
interface Report {
  reportId: string;                    // Auto-generated
  patientId: string;                  // User's Firebase UID
  fileName: string;                   // Original filename
  fileType: string;                   // 'pdf', 'png', 'jpg', etc.
  fileUrl?: string;                   // Firebase Storage URL (if storing file)
  uploadedAt: string;                 // ISO timestamp
  reportText: string;                 // OCR extracted text
  
  // AI Analysis
  symptoms: string[];                 // Extracted symptoms
  aiDiagnosis: {                      // Top AI diagnosis
    orpha_code: string;
    name: string;
    confidence: number;
    icd_codes: string[];
    omim: string[];
  };
  allMatches: Array<{                 // All disease matches
    orpha_code: string;
    name: string;
    confidence: number;
    icd_codes: string[];
    omim: string[];
  }>;
  
  // Report Diagnosis (extracted from report text)
  reportDiagnosis?: string;           // Diagnosis mentioned in report (if any)
  
  // Comparison Result
  diagnosisMatchType: 'matches' | 'differs' | 'no_report_diagnosis';
  reasoning: string;                  // AI-generated explanation of match/difference
  
  // Metadata
  isEdited: boolean;                  // Whether patient edited the diagnosis
  editedAt?: string;                  // Last edit timestamp
  editedBy?: string;                  // 'patient' or 'doctor' (future)
}
```

### 2. `patientProfile/{patientId}`

Stores patient's clinical profile metadata.

```typescript
interface PatientProfile {
  patientId: string;                  // Firebase UID
  shareToken: string;                 // Unique token for sharing
  shareEnabled: boolean;              // Whether sharing is enabled
  shareCreatedAt: string;            // When sharing was enabled
  reportCount: number;               // Total number of reports
  lastReportAt: string;              // Last report timestamp
}
```

### 3. `sharedProfile/{shareToken}`

Public view-only access for doctors.

```typescript
interface SharedProfile {
  shareToken: string;                // Unique token (document ID)
  patientId: string;                  // Patient's Firebase UID
  patientName?: string;               // Optional display name
  createdAt: string;                  // When share link was created
  expiresAt?: string;                 // Optional expiration for security
  viewCount: number;                  // How many times viewed
  lastViewedAt?: string;              // Last access timestamp
}
```

## Indexes Needed

### Firestore Indexes

1. **reports by patientId**
   - Collection: `reports`
   - Fields: `patientId` (ascending), `uploadedAt` (descending)

2. **sharedProfile by patientId**
   - Collection: `sharedProfile`
   - Fields: `patientId` (ascending)

## API Routes

### 1. `POST /api/reports`
- Create a new report with diagnosis
- Input: file/symptoms + diagnosis results
- Output: reportId

### 2. `GET /api/reports?patientId={id}`
- Get all reports for a patient
- Output: array of reports

### 3. `PATCH /api/reports/{reportId}`
- Edit a report (diagnosis, reasoning)
- Input: updated fields
- Output: updated report

### 4. `DELETE /api/reports/{reportId}`
- Delete a report
- Output: success

### 5. `POST /api/patient/share`
- Generate or update share token
- Input: patientId
- Output: shareToken, shareUrl

### 6. `GET /api/shared/{shareToken}`
- Get shared profile data (view-only)
- Input: shareToken
- Output: patient reports, profile info

### 7. `DELETE /api/patient/share`
- Disable sharing
- Input: patientId
- Output: success

## Security Rules

```javascript
// reports collection
match /reports/{reportId} {
  allow read: if request.auth != null && resource.data.patientId == request.auth.uid;
  allow create: if request.auth != null && request.resource.data.patientId == request.auth.uid;
  allow update: if request.auth != null && resource.data.patientId == request.auth.uid;
  allow delete: if request.auth != null && resource.data.patientId == request.auth.uid;
}

// patientProfile collection
match /patientProfile/{patientId} {
  allow read, write: if request.auth != null && patientId == request.auth.uid;
}

// sharedProfile collection
match /sharedProfile/{shareToken} {
  allow read: if true; // Public read access
  allow create, update, delete: if request.auth != null; // Only authenticated users can manage
}
```

## Implementation Plan

1. ✅ Design schema
2. Create API routes for reports CRUD
3. Create API routes for sharing
4. Enhance diagnose page to save reports
5. Enhance diagnose page to show 3 case types
6. Build clinical profile page with report history
7. Add edit functionality
8. Implement shareable link/QR generation
9. Create public view page for doctors
