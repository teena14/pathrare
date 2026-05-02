type RecordLike = Record<string, unknown>;

const GENERIC_TOKENS = new Set([
  'and',
  'care',
  'condition',
  'disease',
  'disorder',
  'for',
  'health',
  'medical',
  'ngo',
  'of',
  'or',
  'patient',
  'rare',
  'support',
  'syndrome',
  'the',
  'with',
]);

export function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => asString(entry)).filter(Boolean) : [];
}

export function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !GENERIC_TOKENS.has(part));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function getPatientConditionPhrases(patient: RecordLike) {
  return uniqueStrings([
    asString(patient.confirmed_condition),
    asString(patient.reported_condition),
    asString(patient.primaryDisease),
  ]);
}

export function getPatientConditionTokens(patient: RecordLike) {
  return uniqueStrings(
    getPatientConditionPhrases(patient)
      .flatMap((value) => tokenize(value))
      .map((value) => normalizeToken(value))
  );
}

export function getPatientRegionLabel(patient: RecordLike) {
  const location = (patient.location && typeof patient.location === 'object' ? patient.location : null) as RecordLike | null;
  const city = asString(location?.city) || asString(patient.location) || asString(patient.city);
  const state = asString(location?.state) || asString(patient.state) || asString(patient.region);
  return [city, state].filter(Boolean).join(', ') || asString(patient.country) || 'Location not added';
}

export function getPatientDisplayName(patient: RecordLike) {
  const fullName = `${asString(patient.firstName)} ${asString(patient.lastName)}`.trim();
  return fullName || asString(patient.displayName) || 'Patient';
}

export function getNgoSpecializationTags(ngo: RecordLike) {
  return uniqueStrings([
    ...asStringArray(ngo.specializationTags),
    ...asStringArray(ngo.focus_tags),
    ...asStringArray(ngo.focusAreas),
  ]);
}

export function getNgoSpecializationSummary(ngo: RecordLike) {
  return (
    asString(ngo.specializationSummary) ||
    asString(ngo.orgDescription) ||
    asString(ngo.about) ||
    ''
  );
}

function getNgoSpecializationPhrases(ngo: RecordLike) {
  return uniqueStrings([
    ...getNgoSpecializationTags(ngo),
    getNgoSpecializationSummary(ngo),
  ]);
}

function hasMedicalFocus(ngo: RecordLike) {
  const tags = getNgoSpecializationTags(ngo).map((entry) => entry.toLowerCase());
  const summary = getNgoSpecializationSummary(ngo).toLowerCase();

  if (tags.length > 0 || summary) {
    return true;
  }

  return tags.some((entry) =>
    ['medical', 'health', 'rare disease', 'care', 'counselling', 'assistive', 'mental health'].some((candidate) =>
      entry.includes(candidate)
    )
  ) || ['medical', 'health', 'rare disease', 'care', 'counselling', 'assistive', 'mental health'].some((candidate) => summary.includes(candidate));
}

export function matchNgoToPatient(ngo: RecordLike, patient: RecordLike) {
  if (!hasMedicalFocus(ngo)) {
    return { applicable: false, reasons: [] as string[], score: 0 };
  }

  const reasons: string[] = ['Direct support from an NGO already active on PathRare'];
  let score = 1;

  const patientConditions = getPatientConditionPhrases(patient).map((value) => value.toLowerCase());
  const patientTokens = getPatientConditionTokens(patient);
  const ngoPhrases = getNgoSpecializationPhrases(ngo).map((value) => value.toLowerCase());
  const ngoTokens = uniqueStrings(
    ngoPhrases.flatMap((value) => tokenize(value)).map((value) => normalizeToken(value))
  );

  const exactPhraseMatch = patientConditions.some((condition) =>
    ngoPhrases.some((phrase) => phrase.includes(condition) || condition.includes(phrase))
  );

  if (exactPhraseMatch) {
    score += 3;
    reasons.push('Specialization overlaps with the patient condition');
  } else {
    const overlappingTokens = patientTokens.filter((token) => ngoTokens.includes(token));
    if (overlappingTokens.length > 0) {
      score += 2;
      reasons.push('Specialization overlaps with the patient need area');
    }
  }

  const patientRegion = getPatientRegionLabel(patient).toLowerCase();
  const ngoRegion = asString(ngo.region).toLowerCase();
  if (ngoRegion && patientRegion.includes(ngoRegion)) {
    score += 1;
    reasons.push(`Operates in ${asString(ngo.region)}`);
  }

  if (!exactPhraseMatch && patientTokens.length === 0) {
    reasons.push('Suitable for rare disease medical support');
  }

  return {
    applicable: score > 0,
    reasons: uniqueStrings(reasons),
    score,
  };
}

function humanizeDiagnosisStatus(value: string) {
  if (!value) return 'Not shared';
  if (value === 'diagnosed') return 'Diagnosed';
  if (value === 'suspected') return 'Suspected';
  if (value === 'undiagnosed') return 'Undiagnosed';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getClinicalProfileLink(patientId: string, patient: RecordLike) {
  void patientId;
  const explicitLink =
    asString(patient.sharedClinicalProfileUrl) ||
    asString(patient.clinicalProfileUrl) ||
    asString(patient.clinical_profile_url);

  if (explicitLink) {
    return explicitLink;
  }

  return null;
}

export function buildPatientConnectionSummary(patient: RecordLike) {
  const patientName = getPatientDisplayName(patient);
  const diagnosisStatus = humanizeDiagnosisStatus(asString(patient.diagnosisStatus).toLowerCase());
  const caregiver = asString(patient.caregiverName);

  const parts = [
    `${patientName} is seeking direct NGO support through PathRare.`,
    `Diagnosis status: ${diagnosisStatus}.`,
  ];

  if (caregiver) {
    parts.push(`Caregiver: ${caregiver}.`);
  }

  return parts.join(' ');
}

export function compactPatientConnectionSummary(summary: string, location?: string | null, condition?: string | null) {
  let next = summary.trim();

  if (location) {
    const escapedLocation = location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    next = next.replace(new RegExp(`\\s*Location:\\s*${escapedLocation}\\.`, 'i'), '');
  }

  if (condition) {
    const escapedCondition = condition.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    next = next.replace(new RegExp(`\\s*Condition focus:\\s*${escapedCondition}\\.`, 'i'), '');
  }

  return next.replace(/\s{2,}/g, ' ').trim();
}
