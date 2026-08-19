import ergData from './erg-distances.json';
import { RECOMMENDATION_DISCLAIMER } from '../disclaimers';

export interface IEvacuationInput {
  unNumber: string;
  hazardClass?: string;
  quantity: number;
  isNight: boolean;
}

export interface IEvacuationResult {
  initialIsolationRadius: number;
  protectiveActionDistance: number;
  isLargeSpill: boolean;
  isFallback: boolean;
  source: string;
  disclaimer: string;
}

const SMALL_SPILL_THRESHOLD_LITERS = 208;
const ROUND_UP_TO = 25;
const MIN_DISTANCE = 25;

const roundUpTo = (value: number, step: number): number => {
  return Math.max(Math.ceil(value / step) * step, MIN_DISTANCE);
};

interface IERGEntry {
  small_spill_isolation_m: number;
  small_spill_protection_day_km: number;
  small_spill_protection_night_km: number;
  large_spill_isolation_m: number;
  large_spill_protection_day_km: number;
  large_spill_protection_night_km: number;
}

const DISCLAIMER = RECOMMENDATION_DISCLAIMER;

const findERGEntry = (unNumber: string, hazardClass?: string): { entry: IERGEntry; source: string; isFallback: boolean } | null => {
  const trimmed = unNumber.trim();
  if (trimmed && /^\d{1,4}$/.test(trimmed)) {
    const padded = trimmed.padStart(4, '0');
    const substanceMatch = ergData.substances.find(
      (s: { un_number: string }) => s.un_number === padded
    );
    if (substanceMatch) {
      return { entry: substanceMatch as IERGEntry, source: `ERG 2024, Table 1 (UN ${padded})`, isFallback: false };
    }
  }

  if (hazardClass) {
    const classMatch = ergData.class_defaults.find(
      (c: { class_code: string }) => c.class_code === hazardClass
    );
    if (classMatch) {
      return { entry: classMatch as IERGEntry, source: `Pauschalwert Klasse ${hazardClass}`, isFallback: true };
    }
  }

  const fallback = ergData.class_defaults.find(
    (c: { class_code: string }) => c.class_code === '6.1'
  );
  if (fallback) {
    return { entry: fallback as IERGEntry, source: 'Konservativer Standardwert (Klasse 6.1)', isFallback: true };
  }

  return null;
};

export const calculateEvacuationRadius = (
  input: IEvacuationInput
): IEvacuationResult => {
  // An unusable quantity (negative, NaN from an empty or malformed input field) must
  // never produce the smallest radius: when the released amount is unknown, assume the
  // worst case. When in doubt, err on the side of protection.
  const hasUsableQuantity = Number.isFinite(input.quantity) && input.quantity >= 0;
  const quantity = hasUsableQuantity ? input.quantity : SMALL_SPILL_THRESHOLD_LITERS + 1;

  const lookup = findERGEntry(input.unNumber, input.hazardClass);

  if (!lookup) {
    return {
      initialIsolationRadius: 100,
      protectiveActionDistance: 500,
      isLargeSpill: quantity > SMALL_SPILL_THRESHOLD_LITERS,
      isFallback: true,
      source: 'Kein ERG-Eintrag gefunden - konservativer Fallback',
      disclaimer: DISCLAIMER,
    };
  }

  const { entry, source, isFallback } = lookup;
  const isLargeSpill = quantity > SMALL_SPILL_THRESHOLD_LITERS;

  let isolationM: number;
  let protectionKm: number;

  if (isLargeSpill) {
    isolationM = entry.large_spill_isolation_m;
    protectionKm = input.isNight
      ? entry.large_spill_protection_night_km
      : entry.large_spill_protection_day_km;
  } else {
    isolationM = entry.small_spill_isolation_m;
    protectionKm = input.isNight
      ? entry.small_spill_protection_night_km
      : entry.small_spill_protection_day_km;
  }

  return {
    initialIsolationRadius: roundUpTo(isolationM, ROUND_UP_TO),
    protectiveActionDistance: roundUpTo(protectionKm * 1000, ROUND_UP_TO),
    isLargeSpill,
    isFallback,
    source,
    disclaimer: DISCLAIMER,
  };
};
