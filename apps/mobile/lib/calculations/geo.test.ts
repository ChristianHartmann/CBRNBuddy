import { circlePolygon, haversineMeters, ILngLat } from './geo';

describe('circlePolygon', () => {
  const center: ILngLat = { longitude: 9.1829, latitude: 48.7758 }; // Stuttgart

  it('returns a closed ring with steps + 1 vertices', () => {
    const steps = 64;
    const poly = circlePolygon(center, 250, steps);
    const ring = poly.geometry.coordinates[0];

    expect(ring).toHaveLength(steps + 1);
    expect(ring[0]).toEqual(ring[ring.length - 1]); // closed
  });

  it('places every vertex ~radiusMeters from the center (<1% error)', () => {
    const radius = 500;
    const poly = circlePolygon(center, radius, 64);
    const ring = poly.geometry.coordinates[0];

    for (const [lng, lat] of ring) {
      const d = haversineMeters(center, { longitude: lng, latitude: lat });
      expect(Math.abs(d - radius) / radius).toBeLessThan(0.01);
    }
  });

  it('scales with the requested radius', () => {
    const small = circlePolygon(center, 100, 32).geometry.coordinates[0];
    const large = circlePolygon(center, 1000, 32).geometry.coordinates[0];

    const dSmall = haversineMeters(center, {
      longitude: small[0][0],
      latitude: small[0][1],
    });
    const dLarge = haversineMeters(center, {
      longitude: large[0][0],
      latitude: large[0][1],
    });

    expect(dLarge).toBeGreaterThan(dSmall * 9); // ~10x, allow margin
  });

  it('uses [longitude, latitude] order', () => {
    // First vertex is due north (bearing 0) → same longitude, higher latitude.
    const poly = circlePolygon(center, 250, 64);
    const [lng, lat] = poly.geometry.coordinates[0][0];
    expect(lng).toBeCloseTo(center.longitude, 4);
    expect(lat).toBeGreaterThan(center.latitude);
  });
});
