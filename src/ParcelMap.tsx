import { useEffect, useRef, useState } from 'react';
import { Focus, Layers3, Minus, Plus } from 'lucide-react';
import type { Parcel } from './model';
import { diagramBounds, initialCenter, initialLayers, initialZoom, overlays, parcelCenter, polygon, type Coordinate, type MapLayers } from './spatial';

type MapEvent = { point: unknown; lngLat: { lng: number; lat: number } };
type MapInstance = {
  on(event: string, callback: (event: MapEvent) => void): void;
  on(event: string, layer: string, callback: () => void): void;
  addSource(id: string, source: Record<string, unknown>): void;
  addLayer(layer: Record<string, unknown>): void;
  setFilter(layer: string, filter: unknown[]): void;
  setLayoutProperty(layer: string, name: string, value: string): void;
  getLayer(id: string): unknown;
  getSource(id: string): { setData(data: unknown): void } | undefined;
  queryRenderedFeatures(point: unknown, options: { layers: string[] }): { properties?: { id?: string } }[];
  easeTo(options: Record<string, unknown>): void;
  zoomIn(): void;
  zoomOut(): void;
  getCanvas(): HTMLCanvasElement;
  remove(): void;
};
type MapStyle = { '--layer-color': string };
type MapModule = { Map: new (options: Record<string, unknown>) => MapInstance };

const satellite = import.meta.env.VITE_SATELLITE_TILE_URL as string | undefined;
const satelliteCredit = import.meta.env.VITE_SATELLITE_ATTRIBUTION as string | undefined;
const library = 'https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js';

function loadMapLibre() {
  const browser = window as Window & { maplibregl?: MapModule; landsafeMapLibre?: Promise<MapModule> };
  if (browser.maplibregl) return Promise.resolve(browser.maplibregl);
  return browser.landsafeMapLibre ??= new Promise<MapModule>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = library;
    script.onload = () => browser.maplibregl ? resolve(browser.maplibregl) : reject(new Error('MapLibre unavailable'));
    script.onerror = () => reject(new Error('Map library could not load'));
    document.head.append(script);
  });
}

function parcelFeatures(parcels: Parcel[]) {
  return { type: 'FeatureCollection', features: parcels.map(p => ({
    type: 'Feature', properties: { id: p.id, survey: p.survey }, geometry: polygon(p.bbox),
  })) };
}

const parcelLayers = ['parcel-fill', 'parcel-outline', 'selected-fill', 'selected-outline', 'survey-labels'];
type Props = {
  parcels: Parcel[]; selected: Parcel | null; pin: Coordinate | null; onSelect: (id: string) => void; onUncovered: (point: Coordinate) => void;
};

export function ParcelMap({ parcels, selected, pin, onSelect, onUncovered }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<MapInstance | null>(null);
  const latest = useRef({ parcels, selected, onSelect, onUncovered });
  latest.current = { parcels, selected, onSelect, onUncovered };
  const [ready, setReady] = useState(false);
  const [layers, setLayers] = useState<MapLayers>(initialLayers);
  const [showSatellite, setShowSatellite] = useState(false);
  const [fallbackZoom, setFallbackZoom] = useState(1);

  useEffect(() => {
    let active = true;
    const start = async () => {
      const module = await loadMapLibre();
      if (!active || !container.current) return;
      const map = new module.Map({
        container: container.current, style: 'https://tiles.openfreemap.org/styles/liberty',
        center: initialCenter, zoom: initialZoom, minZoom: 10, maxZoom: 20,
        attributionControl: true, dragRotate: false, pitchWithRotate: false,
      });
      instance.current = map;
      map.on('load', () => {
        if (!active) return;
        if (satellite && satelliteCredit) {
          map.addSource('satellite', { type: 'raster', tiles: [satellite], tileSize: 256 });
          map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } });
        }
        for (const overlay of overlays) {
          map.addSource(overlay.id, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: polygon(overlay.bbox) } });
          map.addLayer({ id: overlay.id, type: 'fill', source: overlay.id,
            paint: { 'fill-color': overlay.color, 'fill-opacity': overlay.id === 'ftl' ? 0.37 : 0.24 } });
          map.addLayer({ id: overlay.id + '-line', type: 'line', source: overlay.id,
            paint: { 'line-color': overlay.color, 'line-width': 2, 'line-dasharray': overlay.id === 'buffer' ? [3, 2] : [1, 0] } });
        }
        map.addSource('parcels', { type: 'geojson', data: parcelFeatures(latest.current.parcels) });
        map.addLayer({ id: 'parcel-fill', type: 'fill', source: 'parcels', paint: { 'fill-color': '#1f8b69', 'fill-opacity': 0.16 } });
        map.addLayer({ id: 'parcel-outline', type: 'line', source: 'parcels', paint: { 'line-color': '#23825e', 'line-width': 2 } });
        const filter = ['==', ['get', 'id'], latest.current.selected?.id ?? ''];
        map.addLayer({ id: 'selected-fill', type: 'fill', source: 'parcels', filter, paint: { 'fill-color': '#f5c461', 'fill-opacity': 0.4 } });
        map.addLayer({ id: 'selected-outline', type: 'line', source: 'parcels', filter, paint: { 'line-color': '#ad5c0b', 'line-width': 3 } });
        map.addLayer({ id: 'survey-labels', type: 'symbol', source: 'parcels', minzoom: 15, layout: {
          'text-field': ['get', 'survey'], 'text-size': 14, 'text-allow-overlap': true,
        }, paint: { 'text-color': '#183d31', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
        map.addSource('inspection-point', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'inspection-point', type: 'circle', source: 'inspection-point',
          paint: { 'circle-radius': 8, 'circle-color': '#be5f19', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
        map.on('click', (event) => {
          const id = map.queryRenderedFeatures(event.point, { layers: ['parcel-fill'] })[0]?.properties?.id;
          if (id) latest.current.onSelect(id);
          else latest.current.onUncovered([event.lngLat.lng, event.lngLat.lat]);
        });
        map.on('mouseenter', 'parcel-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'parcel-fill', () => { map.getCanvas().style.cursor = ''; });
        setReady(true);
      });
    };
    void start().catch(() => undefined);
    return () => { active = false; instance.current?.remove(); instance.current = null; };
  }, []);

  useEffect(() => {
    if (ready) instance.current?.getSource('parcels')?.setData(parcelFeatures(parcels));
  }, [ready, parcels]);

  useEffect(() => {
    const map = instance.current;
    if (!ready || !map) return;
    const filter = ['==', ['get', 'id'], selected?.id ?? ''];
    map.setFilter('selected-fill', filter);
    map.setFilter('selected-outline', filter);
    if (selected) map.easeTo({ center: parcelCenter(selected), duration: 350 });
  }, [ready, selected]);

  useEffect(() => {
    const map = instance.current;
    if (!ready || !map) return;
    for (const id of parcelLayers) map.setLayoutProperty(id, 'visibility', layers.surveys ? 'visible' : 'none');
    for (const { id } of overlays) {
      const visibility = layers[id] ? 'visible' : 'none';
      map.setLayoutProperty(id, 'visibility', visibility);
      map.setLayoutProperty(id + '-line', 'visibility', visibility);
    }
    if (map.getLayer('satellite')) map.setLayoutProperty('satellite', 'visibility', showSatellite ? 'visible' : 'none');
  }, [ready, layers, showSatellite]);

  useEffect(() => {
    const map = instance.current;
    if (!ready || !map) return;
    map.getSource('inspection-point')?.setData({ type: 'FeatureCollection', features: pin ? [
      { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: pin } },
    ] : [] });
    if (pin) map.easeTo({ center: pin, duration: 220 });
  }, [ready, pin]);

  const toggle = (id: keyof MapLayers) => setLayers(previous => ({ ...previous, [id]: !previous[id] }));
  return <section className="map-panel" aria-label="Survey map">
    <div className="map-underlay" aria-hidden={ready}>
      <div className="map-sketch" style={{ transform: 'scale(' + fallbackZoom + ')' }}>
        <div className="sketch-lake" style={diagramBounds(overlays[1].bbox)} />
        {overlays.filter(({ id }) => layers[id]).map(overlay => <div key={overlay.id}
          className={'diagram-overlay ' + overlay.id} style={{ ...diagramBounds(overlay.bbox), '--layer-color': overlay.color } as React.CSSProperties & MapStyle} />)}
        {layers.surveys && parcels.map(parcel => <button key={parcel.id} tabIndex={ready ? -1 : 0} type="button"
          className={'sketch-parcel' + (selected?.id === parcel.id ? ' selected-parcel' : '')}
          style={diagramBounds(parcel.bbox)} onClick={() => onSelect(parcel.id)} aria-label={'Select survey ' + parcel.survey}>{parcel.survey}</button>)}
      </div>
    </div>
    <div className={'map-canvas' + (ready ? ' ready' : '')} ref={container} />
    <div className="map-toolbar">
      <div className="layer-panel">
        <h2><Layers3 size={16} /> Map layers</h2>
        <label><input type="checkbox" checked={layers.surveys} onChange={() => toggle('surveys')} /> <i className="survey-swatch" /> Survey boundaries</label>
        {overlays.slice().reverse().map(({ id, label, color }) => <label key={id}><input type="checkbox" checked={layers[id]} onChange={() => toggle(id)} />
          <i style={{ background: color }} /> {label}</label>)}
        <span>Sample geometry</span>
      </div>
    </div>
    <div className="map-controls">
      <button aria-label="Zoom in" onClick={() => ready ? instance.current?.zoomIn() : setFallbackZoom(z => Math.min(z + 0.2, 1.8))}><Plus size={19} /></button>
      <button aria-label="Zoom out" onClick={() => ready ? instance.current?.zoomOut() : setFallbackZoom(z => Math.max(z - 0.2, 0.8))}><Minus size={19} /></button>
      <button aria-label="Reset map view" onClick={() => ready ? instance.current?.easeTo({ center: initialCenter, zoom: initialZoom }) : setFallbackZoom(1)}><Focus size={18} /></button>
    </div>
    <div className="map-legend"><span><i className="legend-parcel" /> {selected && layers.surveys ? 'Survey ' + selected.survey : 'No visible selection'}</span>
      <span>{ready ? showSatellite ? 'Satellite' : 'Street map' : 'Diagram view'}</span>
      {ready && satellite && satelliteCredit && <button type="button" onClick={() => setShowSatellite(!showSatellite)}>{showSatellite ? 'Street' : 'Satellite'}</button>}
    </div>
    {showSatellite && ready && <small className="satellite-credit">{satelliteCredit}</small>}
  </section>;
}
