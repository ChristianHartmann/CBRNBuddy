/**
 * Detecting changed reference data.
 *
 * The seed files in assets/data/ are produced by the scripts in scripts/ and change
 * with the regulation (ADR 2023 to ADR 2025, for example). Without this comparison an
 * already seeded database on a device would keep serving the superseded data.
 */

export interface IDataVersion {
  [dataset: string]: string;
}

/** Stable representation, independent of the key order in the JSON file. */
export const serializeDataVersion = (version: IDataVersion): string =>
  JSON.stringify(
    Object.keys(version)
      .sort()
      .map((key) => [key, version[key]])
  );

/**
 * Does the data need to be seeded again? Yes whenever the stored value is missing or
 * does not match, so an unclear state resolves on the safe side.
 */
export const needsReseed = (stored: string | null, bundled: IDataVersion): boolean =>
  stored !== serializeDataVersion(bundled);
