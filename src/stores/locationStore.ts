import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LocationState {
  label: string;
  addressLine: string | null;
  latitude: number | null;
  longitude: number | null;
  addressId: string | null;
  /** Name of the supported city this location was validated into. */
  cityName: string | null;
  /** True once the coordinates passed the coverage check. The marketplace
   *  gate only lets the customer through when this is true. Cleared whenever
   *  the coordinates change so a new pick must be re-validated. */
  validated: boolean;
  setLocation: (loc: {
    label?: string;
    addressLine?: string | null;
    latitude: number;
    longitude: number;
    addressId?: string | null;
    cityName?: string | null;
    validated?: boolean;
  }) => void;
  /** Records the outcome of a coverage check for the current coordinates. */
  setValidated: (validated: boolean, cityName?: string | null) => void;
  clear: () => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      label: 'Choose location',
      addressLine: null,
      latitude: null,
      longitude: null,
      addressId: null,
      cityName: null,
      validated: false,
      setLocation: (loc) =>
        set({
          label: loc.label ?? 'Home',
          addressLine: loc.addressLine ?? null,
          latitude: loc.latitude,
          longitude: loc.longitude,
          addressId: loc.addressId ?? null,
          cityName: loc.cityName ?? null,
          validated: loc.validated ?? false,
        }),
      setValidated: (validated, cityName) =>
        set((s) => ({ validated, cityName: cityName ?? s.cityName })),
      clear: () =>
        set({
          label: 'Choose location',
          addressLine: null,
          latitude: null,
          longitude: null,
          addressId: null,
          cityName: null,
          validated: false,
        }),
    }),
    { name: 'location-storage' }
  )
);
