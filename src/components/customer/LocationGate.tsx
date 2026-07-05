'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useTranslations, useLocale } from 'next-intl';
import { MapPin, Ban } from 'lucide-react';
import api from '@/lib/api';
import { useLocationStore } from '@/stores/locationStore';
import {
  LatLng,
  NamedArea,
  findContainingArea,
  pointInAnyPolygon,
} from '@/lib/geo';
import { LocationPickerMap } from '@/components/maps/LocationPickerMap';
import { Button } from '@/components/ui/Button';

interface BranchData {
  configured: boolean;
  branch: {
    id: string;
    name: string;
    nameAr: string;
    deliveryAreas: NamedArea[];
    excludedPolygons: LatLng[][];
  } | null;
}

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

/**
 * Mandatory location gate for the customer marketplace. A customer may only
 * browse once they have selected a location that validates inside a supported
 * city. This is enforced at the (customer) layout level, so it also covers
 * direct-URL access and returning visitors.
 *
 * Fail policy: FAIL OPEN. If coverage can't be determined (branch endpoint
 * down, or no coverage areas configured yet), browsing is allowed and the hard
 * coverage check still happens at checkout / order creation (server-side).
 * The stored location is RE-VALIDATED on every load against the current
 * coverage polygons — a previously-valid pick that now falls outside coverage
 * forces re-selection.
 */
export function LocationGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const locale = useLocale();
  const mapLang: 'ar' | 'en' = locale === 'ar' ? 'ar' : 'en';

  const { data, error, isLoading } = useSWR<BranchData>('/delivery/branch', fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 60_000,
  });

  const latitude = useLocationStore((s) => s.latitude);
  const longitude = useLocationStore((s) => s.longitude);
  const storedValidated = useLocationStore((s) => s.validated);
  const setLocation = useLocationStore((s) => s.setLocation);
  const setValidated = useLocationStore((s) => s.setValidated);

  // Zustand's persisted state only exists after client hydration — gate on it
  // so we never flash the marketplace (or the picker) before we know the
  // stored location.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const [outOfCoverage, setOutOfCoverage] = useState(false);
  // Optional refinements the customer may add before confirming.
  const [cityChoice, setCityChoice] = useState<string>('');
  const [street, setStreet] = useState<string>('');

  const areas: NamedArea[] = data?.branch?.deliveryAreas ?? [];
  const excluded: LatLng[][] = data?.branch?.excludedPolygons ?? [];
  // Coverage is "usable" only when the branch is configured AND has at least
  // one area drawn. Otherwise we fail open (no gate).
  const coverageConfigured = Boolean(data?.configured) && areas.length > 0;

  /** Cheap client-side re-check of the stored coordinates against the live
   *  coverage polygons — mirrors the server, keeps the gate instant. */
  const cityForPoint = useCallback(
    (pt: LatLng): NamedArea | null => {
      const area = findContainingArea(pt, areas);
      if (!area) return null;
      if (pointInAnyPolygon(pt, excluded)) return null;
      return area;
    },
    [areas, excluded],
  );

  const storedArea = useMemo(() => {
    if (latitude == null || longitude == null) return null;
    return cityForPoint({ lat: latitude, lng: longitude });
  }, [latitude, longitude, cityForPoint]);

  const cityName = useCallback(
    (area: NamedArea) => (mapLang === 'ar' ? area.nameAr || area.name : area.name || area.nameAr),
    [mapLang],
  );

  // Keep the persisted `validated` flag in sync with the live re-check so other
  // parts of the app (checkout, header) can trust it.
  useEffect(() => {
    if (!coverageConfigured || latitude == null || longitude == null) return;
    const nextValidated = storedArea != null;
    const nextCity = storedArea ? cityName(storedArea) : null;
    if (nextValidated !== storedValidated) setValidated(nextValidated, nextCity);
  }, [coverageConfigured, latitude, longitude, storedArea, storedValidated, cityName, setValidated]);

  const handlePinChange = useCallback((loc: { lat: number; lng: number }) => {
    setPin({ lat: loc.lat, lng: loc.lng });
    setOutOfCoverage(false);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!pin) return;
    setChecking(true);
    setOutOfCoverage(false);
    try {
      const res = await api.post('/delivery/check-coverage', { lat: pin.lat, lng: pin.lng });
      const { covered, area } = res.data.data as {
        covered: boolean;
        area: { name: string; nameAr: string } | null;
      };
      if (covered) {
        // Customer's explicit dropdown choice wins for display; otherwise use
        // the city the coordinates resolved into.
        const detected = area
          ? mapLang === 'ar'
            ? area.nameAr || area.name
            : area.name || area.nameAr
          : null;
        setLocation({
          label: 'Home',
          addressLine: street.trim() || null,
          latitude: pin.lat,
          longitude: pin.lng,
          cityName: cityChoice || detected,
          validated: true,
        });
      } else {
        setOutOfCoverage(true);
      }
    } catch {
      // Endpoint unreachable → fall back to the client-side polygon check we
      // already loaded, and fail open when no coverage is configured.
      const area = cityForPoint({ lat: pin.lat, lng: pin.lng });
      if (area || areas.length === 0) {
        setLocation({
          label: 'Home',
          addressLine: street.trim() || null,
          latitude: pin.lat,
          longitude: pin.lng,
          cityName: cityChoice || (area ? cityName(area) : null),
          validated: true,
        });
      } else {
        setOutOfCoverage(true);
      }
    } finally {
      setChecking(false);
    }
  }, [pin, mapLang, setLocation, cityForPoint, areas.length, cityName, cityChoice, street]);

  // ── Render decisions ────────────────────────────────────────────────
  // Still hydrating / loading coverage, or the branch endpoint is unconfigured
  // upstream — show a loader rather than flashing content.
  if (!hydrated || isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand-200 border-t-brand-500 animate-spin" />
      </div>
    );
  }

  // Fail open: coverage couldn't be loaded or isn't configured — let the
  // customer browse; checkout still enforces coverage server-side.
  if (error || !coverageConfigured) {
    return <>{children}</>;
  }

  // Valid stored location inside a supported city → allow the marketplace.
  if (storedArea != null) {
    return <>{children}</>;
  }

  // Otherwise block the marketplace with the location picker.
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-100 flex items-center justify-center">
            <MapPin className="h-7 w-7 text-brand-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{t('locationGate.title')}</h1>
          <p className="text-sm text-gray-600 leading-relaxed">{t('locationGate.body')}</p>
        </div>

        <LocationPickerMap
          lat={pin?.lat ?? null}
          lng={pin?.lng ?? null}
          onChange={handlePinChange}
          language={mapLang}
          height={320}
        />

        {/* Optional refinements — city dropdown + street. */}
        {!outOfCoverage && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                {t('locationGate.cityLabel')}
              </label>
              <select
                value={cityChoice}
                onChange={(e) => setCityChoice(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                <option value="">{t('locationGate.selectCity')}</option>
                {areas.map((a, i) => {
                  const name = mapLang === 'ar' ? a.nameAr || a.name : a.name || a.nameAr;
                  return (
                    <option key={i} value={name}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                {t('locationGate.streetLabel')}
              </label>
              <input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder={t('locationGate.streetPlaceholder')}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>
        )}

        {outOfCoverage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center space-y-1">
            <div className="mx-auto h-9 w-9 rounded-xl bg-red-100 flex items-center justify-center">
              <Ban className="h-5 w-5 text-red-600" />
            </div>
            <p className="font-semibold text-red-700">{t('locationGate.outOfCoverageTitle')}</p>
            <p className="text-xs text-red-600 leading-relaxed">
              {t('locationGate.outOfCoverageBody')}
            </p>
          </div>
        ) : (
          <Button className="w-full" onClick={handleConfirm} loading={checking} disabled={!pin}>
            {checking ? t('locationGate.checking') : t('locationGate.confirm')}
          </Button>
        )}

        {outOfCoverage && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setOutOfCoverage(false)}
          >
            {t('locationGate.tryAgain')}
          </Button>
        )}
      </div>
    </div>
  );
}
