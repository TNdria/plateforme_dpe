/**
 * Grille spatiale pour accélérer les recherches de proximité.
 * Convertit une recherche O(N×M) (toutes paires) en O(N) effectif,
 * en n'examinant que les cellules voisines dans un rayon donné.
 *
 * Repère: 1 degré de latitude ≈ 111 km. À Madagascar (~lat -19°),
 * 1 degré de longitude ≈ 105 km.
 */

const METERS_PER_DEG_LAT = 111_000;

export interface SpatialPoint {
  latitude: number;
  longitude: number;
}

export class SpatialGrid<T extends SpatialPoint> {
  private cells = new Map<string, T[]>();
  private cellSizeDeg: number;

  /** cellSizeMeters: la taille d'une cellule. Choisir ~= radius cible. */
  constructor(points: T[], cellSizeMeters: number) {
    this.cellSizeDeg = cellSizeMeters / METERS_PER_DEG_LAT;
    for (const p of points) {
      if (p.latitude == null || p.longitude == null) continue;
      const key = this.key(p.latitude, p.longitude);
      const arr = this.cells.get(key);
      if (arr) arr.push(p);
      else this.cells.set(key, [p]);
    }
  }

  private key(lat: number, lng: number): string {
    const x = Math.floor(lat / this.cellSizeDeg);
    const y = Math.floor(lng / this.cellSizeDeg);
    return `${x}:${y}`;
  }

  /** Retourne true si au moins un point existe à <= radiusMeters. */
  hasNeighborWithin(lat: number, lng: number, radiusMeters: number): boolean {
    const cellsToCheck = Math.max(1, Math.ceil(radiusMeters / METERS_PER_DEG_LAT / this.cellSizeDeg));
    const cx = Math.floor(lat / this.cellSizeDeg);
    const cy = Math.floor(lng / this.cellSizeDeg);
    const r2 = radiusMeters * radiusMeters;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const mPerDegLng = METERS_PER_DEG_LAT * cosLat;

    for (let dx = -cellsToCheck; dx <= cellsToCheck; dx++) {
      for (let dy = -cellsToCheck; dy <= cellsToCheck; dy++) {
        const cell = this.cells.get(`${cx + dx}:${cy + dy}`);
        if (!cell) continue;
        for (const p of cell) {
          const ddLat = (p.latitude - lat) * METERS_PER_DEG_LAT;
          const ddLng = (p.longitude - lng) * mPerDegLng;
          if (ddLat * ddLat + ddLng * ddLng <= r2) return true;
        }
      }
    }
    return false;
  }

  /** Distance (m) au point le plus proche, ou Infinity. */
  nearestDistance(lat: number, lng: number, maxRadiusMeters: number): number {
    const cellsToCheck = Math.max(1, Math.ceil(maxRadiusMeters / METERS_PER_DEG_LAT / this.cellSizeDeg));
    const cx = Math.floor(lat / this.cellSizeDeg);
    const cy = Math.floor(lng / this.cellSizeDeg);
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const mPerDegLng = METERS_PER_DEG_LAT * cosLat;
    let min2 = Infinity;
    for (let dx = -cellsToCheck; dx <= cellsToCheck; dx++) {
      for (let dy = -cellsToCheck; dy <= cellsToCheck; dy++) {
        const cell = this.cells.get(`${cx + dx}:${cy + dy}`);
        if (!cell) continue;
        for (const p of cell) {
          const ddLat = (p.latitude - lat) * METERS_PER_DEG_LAT;
          const ddLng = (p.longitude - lng) * mPerDegLng;
          const d2 = ddLat * ddLat + ddLng * ddLng;
          if (d2 < min2) min2 = d2;
        }
      }
    }
    return Math.sqrt(min2);
  }
}
