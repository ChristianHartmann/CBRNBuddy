import type * as SQLite from 'expo-sqlite';
import type { ISearchResult } from './search';
import { normalizeUnNumber } from './utils';

export interface ISubstanceDetail extends ISearchResult {
  cas_number: string | null;
  tunnel_code: string | null;
  special_provisions: string | null;
  labels: string | null;
}

const SUBSTANCE_DETAIL_COLUMNS = `
  id, un_number, name_de, name_en, hazard_class, hazard_class_name,
  kemler_number, packing_group, cas_number, tunnel_code,
  special_provisions, labels`;

// Packing group I is the most dangerous, III the least. A variant without one is
// ranked last: it carries no severity information to justify preferring it.
const PACKING_GROUP_RANK: Record<string, number> = { I: 0, II: 1, III: 2 };
const UNRANKED = 3;

const packingGroupRank = (row: ISubstanceDetail): number =>
  row.packing_group ? (PACKING_GROUP_RANK[row.packing_group] ?? UNRANKED) : UNRANKED;

/**
 * Pick one variant out of several sharing a UN number. 570 of 2347 UN numbers have
 * more than one entry and 354 of those differ in class, Kemler number or packing
 * group, so the choice must not depend on insertion order: it decides which hazard
 * data an incident commander is shown. Ties keep the original order.
 */
export const selectMostHazardousVariant = (
  rows: ISubstanceDetail[]
): ISubstanceDetail | null => {
  let best: ISubstanceDetail | null = null;
  let bestRank = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const rank = packingGroupRank(row);
    if (rank < bestRank) {
      best = row;
      bestRank = rank;
    }
  }

  return best;
};

export const getSubstanceByUnNumber = (
  db: SQLite.SQLiteDatabase,
  unNumber: string
): ISubstanceDetail | null =>
  selectMostHazardousVariant(getSubstancesByUnNumber(db, unNumber));

export const getSubstancesByUnNumber = (
  db: SQLite.SQLiteDatabase,
  unNumber: string
): ISubstanceDetail[] => {
  const normalized = normalizeUnNumber(unNumber);
  if (!normalized) {
    return [];
  }
  return db.getAllSync<ISubstanceDetail>(
    `SELECT ${SUBSTANCE_DETAIL_COLUMNS}
     FROM substances
     WHERE un_number = ?
     ORDER BY name_de`,
    normalized
  );
};

/**
 * Narrow the variants of a UN number by the Kemler number read off the placard.
 * UN 1105 PENTANOLE, for example, is Kemler 33 in packing group II and Kemler 30 in
 * packing group III, so the placard already carries the answer.
 *
 * Without a Kemler number, or when it matches nothing, every variant is returned:
 * an OCR reading can be wrong, and hiding data on a wrong reading is worse than
 * showing more than asked for.
 */
export const selectVariantsByKemler = (
  rows: ISubstanceDetail[],
  kemler: string | null
): ISubstanceDetail[] => {
  const normalized = kemler?.trim().toUpperCase();
  if (!normalized) {
    return rows;
  }

  const matching = rows.filter((row) => row.kemler_number?.trim().toUpperCase() === normalized);

  return matching.length > 0 ? matching : rows;
};
