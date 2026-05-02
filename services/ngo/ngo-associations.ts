type RecordLike = Record<string, unknown>;

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => asString(entry)).filter(Boolean) : [];
}

export type NormalizedAvailability = 'available' | 'busy' | 'offline';

export function normalizeAvailability(value: unknown): NormalizedAvailability {
  const text = asString(value).toLowerCase();

  if (text === 'busy' || text === 'focused') {
    return 'busy';
  }

  if (text === 'offline') {
    return 'offline';
  }

  if (text === 'available') {
    return 'available';
  }

  const numeric = Number.parseFloat(text);
  if (!Number.isNaN(numeric)) {
    return numeric > 0 ? 'available' : 'offline';
  }

  return 'available';
}

export function toAvailabilityLabel(value: unknown) {
  const normalized = normalizeAvailability(value);
  if (normalized === 'busy') return 'Busy';
  if (normalized === 'offline') return 'Offline';
  return 'Available';
}

export function getAssociatedNgoIds(record: RecordLike | null | undefined) {
  const fromArray = asStringArray(record?.associated_ngo_ids);
  const legacy = [asString(record?.organization_id), asString(record?.ngo_id)].filter(Boolean);
  return Array.from(new Set([...fromArray, ...legacy]));
}

export function hasNgoAssociation(record: RecordLike | null | undefined, ngoId: string | null | undefined) {
  if (!ngoId) {
    return false;
  }

  return getAssociatedNgoIds(record).includes(ngoId);
}

export function getNgoIdentifiers(record: RecordLike | null | undefined) {
  const organizationId =
    asString(record?.organization_id) ||
    asString(record?.ngo_id) ||
    asString(record?.uid) ||
    null;
  const orgName = asString(record?.orgName) || asString(record?.displayName) || 'Organisation';

  return { organizationId, orgName };
}
