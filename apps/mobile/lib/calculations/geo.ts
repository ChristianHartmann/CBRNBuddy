// Geospatial helpers for drawing the evacuation radius on a map.
// Pure functions, no dependencies - unit-testable per CLAUDE.md (calculations need tests).

const EARTH_RADIUS_M = 6_371_000;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export interface ILngLat {
  longitude: number;
  latitude: number;
}

// Minimal GeoJSON Polygon Feature shape (coordinates are [lng, lat] pairs).
export interface IPolygonFeature {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

/**
 * Build a closed GeoJSON polygon approximating a circle of `radiusMeters`
 * around the given center, for rendering as a map overlay.
 *
 * Uses the spherical destination-point formula. The ring is explicitly closed
 * (first vertex repeated as last). Coordinates are [longitude, latitude] to
 * match the GeoJSON / MapLibre convention.
 */
export const circlePolygon = (
  center: ILngLat,
  radiusMeters: number,
  steps = 64,
): IPolygonFeature => {
  const lat1 = center.latitude * DEG_TO_RAD;
  const lon1 = center.longitude * DEG_TO_RAD;
  const angularDistance = radiusMeters / EARTH_RADIUS_M;

  const ring: number[][] = [];
  for (let i = 0; i < steps; i += 1) {
    const bearing = (i / steps) * 2 * Math.PI;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance) +
        Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
        Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
      );

    ring.push([lon2 * RAD_TO_DEG, lat2 * RAD_TO_DEG]);
  }
  // Close the ring.
  ring.push(ring[0]);

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [ring],
    },
  };
};

/**
 * Great-circle distance in meters between two points (haversine).
 * Exported for tests and potential reuse.
 */
export const haversineMeters = (a: ILngLat, b: ILngLat): number => {
  const dLat = (b.latitude - a.latitude) * DEG_TO_RAD;
  const dLon = (b.longitude - a.longitude) * DEG_TO_RAD;
  const lat1 = a.latitude * DEG_TO_RAD;
  const lat2 = b.latitude * DEG_TO_RAD;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};
