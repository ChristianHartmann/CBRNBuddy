import type * as SQLite from 'expo-sqlite';
import { normalizeUnNumber } from './utils';

export interface IERICard {
  id: number;
  un_number: string;
  substance_name: string;
  ericard_id: string;
  immediate_actions: string;
  firefighting: string;
  personal_protection: string;
  first_aid: string;
  spillage: string;
  hazards: string;
  physical_properties: string;
  evacuation_distance_m: number | null;
  water_hazard_class: string | null;
}

const ERICARD_COLUMNS = `
  id, un_number, substance_name, ericard_id,
  immediate_actions, firefighting, personal_protection,
  first_aid, spillage, hazards, physical_properties,
  evacuation_distance_m, water_hazard_class`;

/**
 * Collapse cards that carry the same content under the same UN number. Six UN numbers
 * hold byte-identical duplicates from the scrape, and showing the reader two entries
 * to choose between that say exactly the same thing is worse than useless.
 */
export const dedupeERICards = (cards: IERICard[]): IERICard[] => {
  const seen = new Set<string>();

  return cards.filter((card) => {
    // The row id is storage bookkeeping, not content, so it must not make a card unique.
    const { id: _id, ...content } = card;
    const key = JSON.stringify(content);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

/**
 * Every card of a UN number. 206 UN numbers carry more than one, up to three, and there
 * is no reliable way to map a card onto a specific substance variant: 195 of them share
 * the substance name. So all of them are returned and the reader picks.
 */
export const getERICardsByUnNumber = (
  db: SQLite.SQLiteDatabase,
  unNumber: string
): IERICard[] => {
  const normalized = normalizeUnNumber(unNumber);
  if (!normalized) {
    return [];
  }
  const cards = db.getAllSync<IERICard>(
    `SELECT ${ERICARD_COLUMNS} FROM ericards WHERE un_number = ? ORDER BY ericard_id, id`,
    normalized
  );

  return dedupeERICards(cards);
};

export const getERICardByUnNumber = (
  db: SQLite.SQLiteDatabase,
  unNumber: string
): IERICard | null => getERICardsByUnNumber(db, unNumber)[0] ?? null;
