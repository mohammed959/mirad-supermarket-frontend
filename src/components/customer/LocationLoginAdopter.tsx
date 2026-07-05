'use client';
import { useEffect, useRef } from 'react';
import { useSWRConfig } from 'swr';
import api from '@/lib/api';
import { CustomerAddress } from '@/types';
import { useCustomerAuthStore } from '@/stores/customerAuthStore';
import { useLocationStore } from '@/stores/locationStore';

const SAME_POINT_EPS = 1e-5; // ~1 m — treat as the same saved address

/**
 * After a customer logs in, adopt the location they already validated at the
 * marketplace gate as their saved default address — so they aren't asked to
 * add the same location again.
 *
 * Runs once the store holds a validated location that isn't yet linked to a
 * saved address (`addressId == null`). If an address with the same coordinates
 * already exists we just link to it; otherwise we create one (default when the
 * customer has no addresses yet, so we never silently override an existing
 * default). Renders nothing.
 */
export function LocationLoginAdopter() {
  const isAuthenticated = useCustomerAuthStore((s) => s.isAuthenticated);
  const latitude = useLocationStore((s) => s.latitude);
  const longitude = useLocationStore((s) => s.longitude);
  const validated = useLocationStore((s) => s.validated);
  const addressId = useLocationStore((s) => s.addressId);
  const cityName = useLocationStore((s) => s.cityName);
  const addressLine = useLocationStore((s) => s.addressLine);
  const setLocation = useLocationStore((s) => s.setLocation);
  const { mutate } = useSWRConfig();

  const runningRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!validated || latitude == null || longitude == null) return;
    if (addressId) return; // already linked to a saved address
    if (runningRef.current) return;
    runningRef.current = true;

    (async () => {
      try {
        const list = (await api.get('/addresses').then((r) => r.data.data)) as CustomerAddress[];
        const existing = list.find(
          (a) =>
            Math.abs(Number(a.latitude) - latitude) < SAME_POINT_EPS &&
            Math.abs(Number(a.longitude) - longitude) < SAME_POINT_EPS,
        );
        if (existing) {
          setLocation({
            label: existing.label,
            addressLine: existing.addressLine,
            latitude: Number(existing.latitude),
            longitude: Number(existing.longitude),
            addressId: existing.id,
            cityName,
            validated: true,
          });
          return;
        }
        const res = await api.post('/addresses', {
          label: 'Home',
          addressLine: addressLine || undefined,
          city: cityName || undefined,
          latitude,
          longitude,
          isDefault: list.length === 0,
        });
        const saved = res.data.data as CustomerAddress;
        await mutate('/addresses');
        setLocation({
          label: saved.label,
          addressLine: saved.addressLine,
          latitude: Number(saved.latitude),
          longitude: Number(saved.longitude),
          addressId: saved.id,
          cityName,
          validated: true,
        });
      } catch {
        // Non-fatal — the customer can still add the address manually later.
        runningRef.current = false;
      }
    })();
  }, [
    isAuthenticated,
    validated,
    latitude,
    longitude,
    addressId,
    cityName,
    addressLine,
    setLocation,
    mutate,
  ]);

  return null;
}
