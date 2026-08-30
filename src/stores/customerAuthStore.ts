'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import api from '@/lib/api';
import { useFavoritesStore } from './favoritesStore';
import { useCartStore } from './cartStore';

interface CustomerAuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;

  requestOtp: (mobile: string) => Promise<{ code?: string }>;
  verifyOtp: (mobile: string, code: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

async function loadCustomerSideEffects() {
  await Promise.allSettled([
    useFavoritesStore.getState().load(),
    useCartStore.getState().mergeOnLogin(),
  ]);
}

/**
 * Customer-only authentication store. Persists under `customer-auth-storage`
 * — that JSON blob is the single source of truth for the bearer token; the
 * api interceptor reads it directly. Has no awareness of staff sessions —
 * admins logged in in the same browser are orthogonal to this store.
 */
export const useCustomerAuthStore = create<CustomerAuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,

      requestOtp: async (mobile) => {
        const res = await api.post('/auth/request-otp', { mobile });
        return res.data.data;
      },

      verifyOtp: async (mobile, code) => {
        const res = await api.post('/auth/verify-otp', { mobile, code });
        const { token, user } = res.data.data;
        set({ token, user, isAuthenticated: true });
        await loadCustomerSideEffects();
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
        useFavoritesStore.getState().reset();
        useCartStore.getState().resetCart();
      },

      fetchMe: async () => {
        try {
          set({ loading: true });
          const res = await api.get('/auth/me');
          // Defensive: if the persisted token somehow resolves to a non-CUSTOMER
          // profile, drop it. Customer routes should only ever see CUSTOMER.
          if (res.data.data.role !== 'CUSTOMER') {
            set({ user: null, token: null, isAuthenticated: false });
            return;
          }
          set({ user: res.data.data, isAuthenticated: true });
          await loadCustomerSideEffects();
        } catch {
          set({ user: null, isAuthenticated: false });
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: 'customer-auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
