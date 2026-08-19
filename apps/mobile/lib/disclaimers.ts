/**
 * The wordings that remind the reader a figure is an aid, not a decision.
 *
 * Kept in one place because they used to be spelled out separately in two calculation
 * modules and two screens, which is how a legally relevant sentence quietly drifts into
 * four slightly different versions.
 */

const COMMANDER_DECIDES = 'Die Entscheidung liegt beim Einsatzleiter.';

/** For values derived from a rulebook: correct in principle, still a recommendation. */
export const RECOMMENDATION_DISCLAIMER =
  `Dies ist eine Empfehlung. ${COMMANDER_DECIDES} Fachberater ABC hinzuziehen!`;

/** For values from a simplified model, where the real figure depends on conditions. */
export const APPROXIMATION_DISCLAIMER =
  'Dies ist eine Näherung. Tatsächlicher Verbrauch hängt von Fitness, Belastung und ' +
  `Gerät ab. ${COMMANDER_DECIDES}`;
