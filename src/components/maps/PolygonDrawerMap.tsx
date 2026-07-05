'use client';
import { useCallback, useRef, useState } from 'react';
import {
  GoogleMap,
  Marker,
  Polygon as GMapPolygon,
  Polyline as GMapPolyline,
  useJsApiLoader,
} from '@react-google-maps/api';
import {
  Loader2,
  MapPin,
  Plus,
  Ban,
  Trash2,
  Check,
  Undo2,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_LIBRARIES,
  DEFAULT_MAP_CENTER,
} from '@/lib/maps';
import { LatLng, NamedArea, isPolygonInsidePolygon, isValidPolygon } from '@/lib/geo';

interface Props {
  storeLat: number | null;
  storeLng: number | null;
  /** Named service areas (one per supported city). */
  areas: NamedArea[];
  excludedPolygons: LatLng[][];
  onChange: (next: { areas: NamedArea[]; excluded: LatLng[][] }) => void;
  /** Surfaced validation problems (e.g. excluded drawn outside all areas). */
  onError?: (message: string) => void;
  language?: 'ar' | 'en';
  height?: number;
}

const AREA_STYLE = {
  fillColor: '#0fbea0',
  fillOpacity: 0.15,
  strokeColor: '#0fbea0',
  strokeWeight: 2,
};
const EXCLUDED_STYLE = {
  fillColor: '#ef4444',
  fillOpacity: 0.25,
  strokeColor: '#ef4444',
  strokeWeight: 2,
};

function pathToCoords(poly: google.maps.Polygon): LatLng[] {
  return poly
    .getPath()
    .getArray()
    .map((p) => ({ lat: p.lat(), lng: p.lng() }));
}

/** True when the ring sits inside at least one of the service areas. */
function insideAnyArea(ring: LatLng[], areas: NamedArea[]): boolean {
  return areas.some((a) => isValidPolygon(a.polygon) && isPolygonInsidePolygon(ring, a.polygon));
}

type DrawTarget = 'area' | 'excluded' | null;

export function PolygonDrawerMap({
  storeLat,
  storeLng,
  areas,
  excludedPolygons,
  onChange,
  onError,
  language = 'en',
  height = 420,
}: Props) {
  const t = useTranslations();
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
    language,
    region: 'SA',
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const areaRefs = useRef<Array<google.maps.Polygon | null>>([]);
  const excludedRefs = useRef<Array<google.maps.Polygon | null>>([]);
  const [drawTarget, setDrawTarget] = useState<DrawTarget>(null);
  // Vertices collected while actively drawing a new polygon (click-to-draw,
  // since the Maps DrawingManager was removed in API v3.65).
  const [draft, setDraft] = useState<LatLng[]>([]);

  const center =
    storeLat != null && storeLng != null
      ? { lat: storeLat, lng: storeLng }
      : DEFAULT_MAP_CENTER;

  // Read current geometry from live overlays (so in-place vertex edits are
  // captured) and push it up. Names are preserved from props by index.
  const emit = useCallback(
    (override?: { areas?: NamedArea[]; excluded?: LatLng[][] }) => {
      const nextAreas =
        override?.areas !== undefined
          ? override.areas
          : areas.map((a, i) => {
              const ref = areaRefs.current[i];
              return ref ? { ...a, polygon: pathToCoords(ref) } : a;
            });
      const nextExcluded =
        override?.excluded !== undefined
          ? override.excluded
          : excludedRefs.current.length
            ? excludedRefs.current
                .filter((r): r is google.maps.Polygon => r != null)
                .map(pathToCoords)
            : excludedPolygons;
      onChange({ areas: nextAreas, excluded: nextExcluded });
    },
    [areas, excludedPolygons, onChange],
  );

  const startDrawing = useCallback(
    (target: Exclude<DrawTarget, null>) => {
      if (target === 'excluded' && areas.length === 0) {
        onError?.(t('admin.drawAreaFirst'));
        return;
      }
      setDraft([]);
      setDrawTarget(target);
    },
    [areas.length, onError, t],
  );

  const cancelDrawing = useCallback(() => {
    setDraft([]);
    setDrawTarget(null);
  }, []);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!drawTarget || !e.latLng) return;
      const pt = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      setDraft((d) => [...d, pt]);
    },
    [drawTarget],
  );

  const finishDrawing = useCallback(() => {
    const coords = draft;
    if (!isValidPolygon(coords)) {
      onError?.(t('admin.polygonTooFewPoints'));
      return;
    }

    if (drawTarget === 'area') {
      // Append a new, unnamed service area — the admin names it in the list.
      emit({ areas: [...areas, { name: '', nameAr: '', polygon: coords }] });
    } else if (drawTarget === 'excluded') {
      if (!insideAnyArea(coords, areas)) {
        onError?.(t('admin.excludedOutsideAreas'));
        return;
      }
      emit({ excluded: [...excludedPolygons, coords] });
    }

    setDraft([]);
    setDrawTarget(null);
  }, [draft, drawTarget, areas, excludedPolygons, emit, onError, t]);

  const undoLastPoint = useCallback(() => {
    setDraft((d) => d.slice(0, -1));
  }, []);

  const updateAreaName = useCallback(
    (index: number, patch: Partial<Pick<NamedArea, 'name' | 'nameAr'>>) => {
      const next = areas.map((a, i) => (i === index ? { ...a, ...patch } : a));
      emit({ areas: next });
    },
    [areas, emit],
  );

  const deleteArea = useCallback(
    (index: number) => {
      const nextAreas = areas.filter((_, i) => i !== index);
      areaRefs.current.splice(index, 1);
      // Drop excluded rings that no longer sit inside any remaining area.
      const nextExcluded = excludedPolygons.filter((ring) => insideAnyArea(ring, nextAreas));
      emit({ areas: nextAreas, excluded: nextExcluded });
    },
    [areas, excludedPolygons, emit],
  );

  const deleteExcluded = useCallback(
    (index: number) => {
      const next = excludedPolygons.filter((_, i) => i !== index);
      excludedRefs.current.splice(index, 1);
      emit({ excluded: next });
    },
    [excludedPolygons, emit],
  );

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-6 text-center text-sm text-amber-800"
        style={{ height }}
      >
        <MapPin className="h-6 w-6 mb-2" />
        <p className="font-semibold">Google Maps API key not configured</p>
        <p className="text-xs mt-1">
          Set <span className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</span>.
        </p>
      </div>
    );
  }
  if (loadError) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
        style={{ height }}
      >
        Failed to load Google Maps.
      </div>
    );
  }
  if (!isLoaded) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl bg-gray-100 animate-pulse"
        style={{ height }}
      >
        <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
      </div>
    );
  }

  const isDrawing = drawTarget != null;
  const draftStyle = drawTarget === 'excluded' ? EXCLUDED_STYLE : AREA_STYLE;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      {isDrawing ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={finishDrawing}
            disabled={draft.length < 3}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {t('admin.finishArea')}
          </button>
          <button
            type="button"
            onClick={undoLastPoint}
            disabled={draft.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            <Undo2 className="h-4 w-4" />
            {t('admin.undoPoint')}
          </button>
          <button
            type="button"
            onClick={cancelDrawing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
          >
            <X className="h-4 w-4" />
            {t('common.cancel')}
          </button>
          <span className="text-xs font-medium text-gray-500">
            {t('admin.pointsCount', { count: draft.length })}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => startDrawing('area')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100"
          >
            <Plus className="h-4 w-4" />
            {t('admin.addArea')}
          </button>

          <button
            type="button"
            onClick={() => startDrawing('excluded')}
            disabled={areas.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            <Ban className="h-4 w-4" />
            {t('admin.addExcludedArea')}
          </button>
        </div>
      )}

      {isDrawing && (
        <p className="text-xs font-medium text-gray-600">
          {drawTarget === 'area' ? t('admin.drawAreaHint') : t('admin.drawExcludedHint')}
        </p>
      )}

      <div
        className="relative overflow-hidden rounded-2xl border border-gray-200 shadow-soft"
        style={{ height }}
      >
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={center}
          zoom={storeLat != null && storeLng != null ? 12 : 10}
          onLoad={(map) => {
            mapRef.current = map;
          }}
          onUnmount={() => {
            mapRef.current = null;
          }}
          onClick={handleMapClick}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: 'greedy',
            clickableIcons: false,
            mapTypeControl: false,
            fullscreenControl: false,
            streetViewControl: false,
            draggableCursor: isDrawing ? 'crosshair' : undefined,
          }}
        >
          {/* Store location */}
          {storeLat != null && storeLng != null && (
            <Marker
              position={{ lat: storeLat, lng: storeLng }}
              title={t('admin.storeLocation')}
            />
          )}

          {/* Service areas (editable when not drawing) */}
          {areas.map((area, i) =>
            isValidPolygon(area.polygon) ? (
              <GMapPolygon
                // eslint-disable-next-line react/no-array-index-key
                key={`area-${i}`}
                paths={area.polygon}
                editable={!isDrawing}
                draggable={!isDrawing}
                options={AREA_STYLE}
                onLoad={(poly) => {
                  areaRefs.current[i] = poly;
                }}
                onUnmount={() => {
                  areaRefs.current[i] = null;
                }}
                onMouseUp={() => emit()}
                onDragEnd={() => emit()}
              />
            ) : null,
          )}

          {/* Excluded polygons (editable when not drawing) */}
          {excludedPolygons.map((ring, i) => (
            <GMapPolygon
              // eslint-disable-next-line react/no-array-index-key
              key={`excluded-${i}`}
              paths={ring}
              editable={!isDrawing}
              draggable={!isDrawing}
              options={EXCLUDED_STYLE}
              onLoad={(poly) => {
                excludedRefs.current[i] = poly;
              }}
              onUnmount={() => {
                excludedRefs.current[i] = null;
              }}
              onMouseUp={() => emit()}
              onDragEnd={() => emit()}
            />
          ))}

          {/* In-progress draft: area preview once 3+ points, otherwise a line */}
          {isDrawing && draft.length >= 3 && (
            <GMapPolygon paths={draft} options={{ ...draftStyle, clickable: false }} />
          )}
          {isDrawing && draft.length >= 2 && draft.length < 3 && (
            <GMapPolyline
              path={draft}
              options={{ strokeColor: draftStyle.strokeColor, strokeWeight: 2, clickable: false }}
            />
          )}
          {/* Draft vertex dots */}
          {isDrawing &&
            draft.map((p, i) => (
              <Marker
                // eslint-disable-next-line react/no-array-index-key
                key={`draft-${i}`}
                position={p}
                icon={{
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 5,
                  fillColor: draftStyle.strokeColor,
                  fillOpacity: 1,
                  strokeColor: '#fff',
                  strokeWeight: 2,
                }}
              />
            ))}
        </GoogleMap>

        {/* Legend */}
        <div className="pointer-events-none absolute bottom-3 start-3 z-10 space-y-1 rounded-xl bg-white/90 px-3 py-2 text-[11px] font-medium text-gray-700 shadow-soft backdrop-blur">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-500/40 ring-1 ring-brand-500" />
            {t('admin.serviceAreas')}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500/40 ring-1 ring-red-500" />
            {t('admin.excludedAreas')}
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-gray-700" />
            {t('admin.storeLocation')}
          </div>
        </div>
      </div>

      {/* Service areas list — name each city (EN + AR) */}
      {areas.length > 0 && (
        <ul className="space-y-2">
          {areas.map((area, i) => (
            <li
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              className="rounded-xl border border-gray-100 bg-white p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-500/40 ring-1 ring-brand-500" />
                  {t('admin.areaN', { n: i + 1 })}
                  <span className="text-[11px] font-normal text-gray-400">
                    {t('admin.pointsCount', { count: area.polygon.length })}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => deleteArea(i)}
                  className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('common.delete')}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  value={area.name}
                  onChange={(e) => updateAreaName(i, { name: e.target.value })}
                  placeholder={t('admin.areaNameEn')}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                <input
                  value={area.nameAr}
                  onChange={(e) => updateAreaName(i, { nameAr: e.target.value })}
                  placeholder={t('admin.areaNameAr')}
                  dir="rtl"
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Excluded areas list with delete */}
      {excludedPolygons.length > 0 && (
        <ul className="space-y-1.5">
          {excludedPolygons.map((_, i) => (
            <li
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm"
            >
              <span className="inline-flex items-center gap-2 text-gray-700">
                <Ban className="h-4 w-4 text-red-500" />
                {t('admin.excludedAreaN', { n: i + 1 })}
              </span>
              <button
                type="button"
                onClick={() => deleteExcluded(i)}
                className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                {t('common.delete')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
