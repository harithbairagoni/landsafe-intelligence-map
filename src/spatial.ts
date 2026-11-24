import type { Parcel } from './model';

export type Coordinate = [longitude: number, latitude: number];
export type Rectangle = [west: number, south: number, east: number, north: number];

export const initialCenter: Coordinate = [78.32810, 17.46718];
export const initialZoom = 16.7;
export const diagramExtent: Rectangle = [78.32665, 17.46625, 78.32940, 17.46810];

export const overlays = [
  { id: 'buffer', label: 'Lake buffer', color: '#a797ea', bbox: [78.32731, 17.46683, 78.32809, 17.46779] as Rectangle },
  { id: 'ftl', label: 'Full Tank Level', color: '#55bfd3', bbox: [78.32747, 17.46696, 78.32799, 17.46770] as Rectangle },
] as const;

export type OverlayId = typeof overlays[number]['id'];
export type MapLayers = Record<OverlayId | 'surveys', boolean>;
export const initialLayers: MapLayers = { surveys: true, ftl: true, buffer: false };

export function polygon(box: number[]) {
  const [west, south, east, north] = box;
  return { type: 'Polygon', coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] };
}

export function parcelCenter(parcel: Parcel): Coordinate {
  const [west, south, east, north] = parcel.bbox;
  return [(west + east) / 2, (south + north) / 2];
}

export function diagramBounds(box: number[]) {
  const [west, south, east, north] = box;
  const [left, bottom, right, top] = diagramExtent;
  return {
    left: 100 * (west - left) / (right - left) + '%',
    top: 100 * (top - north) / (top - bottom) + '%',
    width: 100 * (east - west) / (right - left) + '%',
    height: 100 * (north - south) / (top - bottom) + '%',
  };
}

export function searchParcels(parcels: Parcel[], query: string) {
  const clean = query.trim().toLowerCase().replace(/^sy[.]?\s*(?:no[.]?\s*)?/, 'survey ');
  const terms = clean.split(/[\s,]+/).filter(Boolean);
  return parcels.filter(p => {
    const haystack = ['survey', p.survey, 'plot', p.plot, p.village, p.mandal, p.district].join(' ').toLowerCase();
    return terms.every(term => haystack.includes(term));
  });
}

export function initialParcelId(href: string, parcels: Parcel[]) {
  const id = new URL(href).searchParams.get('parcel');
  return parcels.find(p => p.id === id)?.id ?? parcels[0]?.id ?? null;
}

export function parseCoordinate(query: string): Coordinate | null {
  const match = query.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lng, lat] : null;
}

export function parcelAtPoint(parcels: Parcel[], [lng, lat]: Coordinate) {
  return parcels.filter(({ bbox: [west, south, east, north] }) =>
    lng >= west && lng <= east && lat >= south && lat <= north,
  );
}
