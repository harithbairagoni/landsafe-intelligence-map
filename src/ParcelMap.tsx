import { useEffect, useRef, useState } from 'react';
import { Focus, Layers2, Minus, Plus } from 'lucide-react';
import type { Parcel } from './model';

type Coordinate = [number, number];
type MapInstance = {
  on(event: string, callback: () => void): void;
  on(event: string, layer: string, callback: (event: { features?: { properties?: { id?: string } }[] }) => void): void;
  addSource(id: string, source: Record<string, unknown>): void;
  addLayer(layer: Record<string, unknown>, before?: string): void;
  setFilter(layer: string, filter: unknown[]): void;
  setLayoutProperty(layer: string, name: string, value: string): void;
  getLayer(id: string): unknown;
  easeTo(options: Record<string, unknown>): void;
  zoomIn(): void;
  zoomOut(): void;
  getCanvas(): HTMLCanvasElement;
  remove(): void;
};
type MapModule = { Map: new (options: Record<string, unknown>) => MapInstance };
const center: Coordinate = [78.32813, 17.46717];
const satellite = import.meta.env.VITE_SATELLITE_TILE_URL as string | undefined;
const satelliteCredit = import.meta.env.VITE_SATELLITE_ATTRIBUTION as string | undefined;
const library = 'https://unpkg.com/maplibre-gl@6.19.0/dist/maplibre-gl.mjs';

function polygon(box: number[]) {
  const [x, y, X, Y] = box;
  return { type: 'Polygon', coordinates: [[[x,y],[X,y],[X,Y],[x,Y],[x,y]]] };
}

export function ParcelMap({ parcels, selected, onSelect }: {
  parcels: Parcel[]; selected: Parcel; onSelect: (parcel: Parcel) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<MapInstance | null>(null);
  const choose = useRef(onSelect);
  const currentId = useRef(selected.id);
  const [ready, setReady] = useState(false);
  const [showFtl, setShowFtl] = useState(true);
  const [showSatellite, setShowSatellite] = useState(false);
  const [fallbackZoom, setFallbackZoom] = useState(1);
  choose.current = onSelect;
  currentId.current = selected.id;

  useEffect(() => {
    let active = true;
    const start = async () => {
      const module = await import(/* @vite-ignore */ library) as MapModule;
      if (!active || !container.current) return;
      const map = new module.Map({
        container: container.current, style: 'https://tiles.openfreemap.org/styles/liberty',
        center, zoom: 16.3, minZoom: 12, maxZoom: 20, attributionControl: true, pitchWithRotate: false,
      });
      instance.current = map;
      map.on('load', () => {
        if (!active) return;
        if (satellite && satelliteCredit) {
          map.addSource('satellite', { type: 'raster', tiles: [satellite], tileSize: 256 });
          map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } });
        }
        map.addSource('ftl', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: polygon([78.32747,17.46696,78.32799,17.46770]) } });
        map.addLayer({ id: 'ftl', type: 'fill', source: 'ftl', paint: { 'fill-color': '#319eb3', 'fill-opacity': 0.47, 'fill-outline-color': '#0c6373' } });
        map.addSource('parcels', { type: 'geojson', data: { type: 'FeatureCollection', features: parcels.map(p => ({ type: 'Feature', properties: { id: p.id }, geometry: polygon(p.bbox) })) } });
        map.addLayer({ id: 'parcels', type: 'fill', source: 'parcels', paint: { 'fill-color': '#55724d', 'fill-opacity': 0.35, 'fill-outline-color': '#eaf0dc' } });
        const filter = ['==', ['get', 'id'], currentId.current];
        map.addLayer({ id: 'selected-fill', type: 'fill', source: 'parcels', filter, paint: { 'fill-color': '#e8b43a', 'fill-opacity': 0.45 } });
        map.addLayer({ id: 'selected-line', type: 'line', source: 'parcels', filter, paint: { 'line-color': '#ffed94', 'line-width': 3 } });
        map.on('click', 'parcels', (event) => {
          const match = parcels.find(p => p.id === event.features?.[0]?.properties?.id);
          if (match) choose.current(match);
        });
        map.on('mouseenter', 'parcels', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'parcels', () => { map.getCanvas().style.cursor = ''; });
        setReady(true);
      });
    };
    void start().catch(() => undefined);
    return () => { active = false; instance.current?.remove(); instance.current = null; };
  }, [parcels]);

  useEffect(() => {
    const map = instance.current;
    if (!ready || !map?.getLayer('selected-fill')) return;
    const filter = ['==', ['get', 'id'], selected.id];
    map.setFilter('selected-fill', filter);
    map.setFilter('selected-line', filter);
    const [x, y, X, Y] = selected.bbox;
    map.easeTo({ center: [(x + X) / 2, (y + Y) / 2], duration: 380 });
  }, [ready, selected]);

  useEffect(() => {
    const map = instance.current;
    if (!ready || !map) return;
    if (map.getLayer('ftl')) map.setLayoutProperty('ftl', 'visibility', showFtl ? 'visible' : 'none');
    if (map.getLayer('satellite')) map.setLayoutProperty('satellite', 'visibility', showSatellite ? 'visible' : 'none');
  }, [ready, showFtl, showSatellite]);

  return <section className="map-panel" aria-label="Parcel map">
    <div className="map-underlay" aria-hidden={ready}>
      <div className="map-sketch" style={{ transform: 'scale(' + fallbackZoom + ')' }}>
        <div className="sketch-lake" />
        {showFtl && <div className="sketch-ftl" />}
        {parcels.map((parcel, i) => <button key={parcel.id} tabIndex={ready ? -1 : 0} type="button"
          className={'sketch-parcel sketch-' + i + (selected.id === parcel.id ? ' selected-parcel' : '')}
          onClick={() => onSelect(parcel)} aria-label={'Select survey ' + parcel.survey}>{parcel.survey}</button>)}
      </div>
    </div>
    <div className={'map-canvas' + (ready ? ' ready' : '')} ref={container} />
    <div className="map-toolbar">
      <span className="map-label">{ready ? (showSatellite ? 'Satellite' : 'Street map') : 'Diagram view'}</span>
      {ready && satellite && satelliteCredit && <button type="button" className="map-label" onClick={() => setShowSatellite(!showSatellite)}>{showSatellite ? 'Street map' : 'Satellite'}</button>}
      <button type="button" className="map-label" aria-pressed={showFtl} onClick={() => setShowFtl(!showFtl)}><Layers2 size={15} /> FTL</button>
    </div>
    <div className="map-controls">
      <button aria-label="Zoom in" onClick={() => ready ? instance.current?.zoomIn() : setFallbackZoom(z => Math.min(z + 0.2, 1.8))}><Plus size={19} /></button>
      <button aria-label="Zoom out" onClick={() => ready ? instance.current?.zoomOut() : setFallbackZoom(z => Math.max(z - 0.2, 0.8))}><Minus size={19} /></button>
      <button aria-label="Reset map view" onClick={() => ready ? instance.current?.easeTo({ center, zoom: 16.3 }) : setFallbackZoom(1)}><Focus size={18} /></button>
    </div>
    <div className="map-legend"><span><i className="legend-parcel" /> Selected parcel</span>{showFtl && <span><i className="legend-ftl" /> Sample FTL</span>}</div>
    {showSatellite && ready && <small className="satellite-credit">{satelliteCredit}</small>}
  </section>;
}
