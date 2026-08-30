import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem } from '@/types';

/**
 * Minimal shape `addProduct` needs. Any of the marketplace product types
 * (`Product`, `MarketplaceProduct`, `HomeProductCard`) satisfy this — the
 * cart stores the fields it uses via `addItem` and drops everything else.
 * `nameAr` is optional; missing → the localized `name` is stored twice so
 * downstream renderers with a locale fallback still work.
 */
export interface AddableProduct {
  id: string;
  name: string;
  nameAr?: string | null;
  imageUrl: string | null;
  price: string | number | null;
}
import api from '@/lib/api';

interface DeliveryFeeResult {
  fee: number;
  distanceKm: number | null;
  reason: string;
}

interface ServerCartItem {
  itemId: string;
  productId: string;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  price: number;
  quantity: number;
  subtotal: number;
  available: boolean;
}

interface CartState {
  items: CartItem[];
  deliveryFee: number;
  deliveryReason: string;
  isOpen: boolean;

  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  /**
   * The only marketplace add-to-basket entry point. Reads product-level
   * price; tracks the basket line under `productId`. The cart is
   * customer-only server-side — this optimistically updates the local
   * basket and pushes the same increment to `POST /cart/items`, rolling
   * back on failure (e.g. insufficient stock). Callers must confirm the
   * shopper is authenticated before calling this — the store does not
   * gate on auth itself.
   */
  addProduct: (product: AddableProduct) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => void;
  /** Wipe the local basket only — no server call. Used on logout. */
  resetCart: () => void;
  openCart: () => void;
  closeCart: () => void;

  setItemsFromReorder: (items: CartItem[]) => void;
  mergeOnLogin: () => Promise<void>;

  subtotal: () => number;
  itemCount: () => number;
  total: () => number;

  fetchDeliveryFee: (lat?: number, lng?: number) => Promise<void>;
}

function toCartItem(row: ServerCartItem): CartItem {
  return {
    productId: row.productId,
    productName: row.name,
    productNameAr: row.name,
    productImage: row.imageUrl,
    price: row.price,
    quantity: row.quantity,
  };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      deliveryFee: 10,
      deliveryReason: 'FLAT',
      isOpen: false,

      addItem: (newItem) => {
        const items = get().items;
        const existing = items.find((i) => i.productId === newItem.productId);
        // Coerce price to number — Prisma Decimal serialises as string in JSON
        const price = Number(newItem.price);
        if (existing) {
          set({
            items: items.map((i) =>
              i.productId === newItem.productId
                ? { ...i, quantity: i.quantity + 1 }
                : i
            ),
          });
        } else {
          set({ items: [...items, { ...newItem, price, quantity: 1 }] });
        }
      },

      addProduct: async (product) => {
        get().addItem({
          productId: product.id,
          productName: product.name,
          // MarketplaceProduct drops `nameAr` from the wire — the localized
          // `name` already reflects the current lang, so falling back to it
          // keeps downstream renderers with a locale fallback working.
          productNameAr: product.nameAr ?? product.name,
          productImage: product.imageUrl,
          price: Number(product.price ?? 0),
        });
        try {
          await api.post('/cart/items', {
            productId: product.id,
            quantity: 1,
            action: 'increment',
          });
        } catch (err) {
          // Roll back the optimistic add (e.g. out of stock server-side).
          const items = get().items;
          const existing = items.find((i) => i.productId === product.id);
          if (existing && existing.quantity <= 1) {
            set({ items: items.filter((i) => i.productId !== product.id) });
          } else if (existing) {
            set({
              items: items.map((i) =>
                i.productId === product.id ? { ...i, quantity: i.quantity - 1 } : i
              ),
            });
          }
          throw err;
        }
      },

      removeItem: async (productId) => {
        const items = get().items;
        const removed = items.find((i) => i.productId === productId);
        set({ items: items.filter((i) => i.productId !== productId) });
        if (!removed) return;
        try {
          await api.delete(`/cart/items/${productId}`);
        } catch (err) {
          // Roll back — restore the removed line.
          set({ items: [...get().items, removed] });
          throw err;
        }
      },

      updateQuantity: async (productId, quantity) => {
        const items = get().items;
        const existing = items.find((i) => i.productId === productId);
        if (!existing) return;
        const delta = quantity - existing.quantity;
        if (delta === 0) return;

        if (quantity <= 0) {
          await get().removeItem(productId);
          return;
        }

        set({
          items: items.map((i) =>
            i.productId === productId ? { ...i, quantity } : i
          ),
        });
        try {
          await api.post('/cart/items', {
            productId,
            quantity: Math.abs(delta),
            action: delta > 0 ? 'increment' : 'decrement',
          });
        } catch (err) {
          // Roll back to the pre-change quantity.
          set({
            items: get().items.map((i) =>
              i.productId === productId ? { ...i, quantity: existing.quantity } : i
            ),
          });
          throw err;
        }
      },

      clearCart: () => {
        set({ items: [] });
        // Best-effort — the local order already succeeded either way.
        api.delete('/cart').catch(() => {});
      },

      resetCart: () => set({ items: [] }),

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      // Replace the cart wholesale (used by reorder flow). The reorder
      // backend already emits product-keyed items, so we just trust them.
      setItemsFromReorder: (items) => set({ items }),

      // Hook invoked after login. The customer's server cart (from a
      // previous session/device) is the source of truth once authenticated
      // — replace the local basket wholesale with it.
      mergeOnLogin: async () => {
        try {
          const res = await api.get<{ data: { items: ServerCartItem[] } }>('/cart');
          set({ items: res.data.data.items.map(toCartItem) });
        } catch {
          // Keep whatever was already in the local basket.
        }
      },

      subtotal: () =>
        get().items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0),

      itemCount: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),

      total: () => get().subtotal() + Number(get().deliveryFee),

      fetchDeliveryFee: async (lat, lng) => {
        try {
          const res = await api.post<{ data: DeliveryFeeResult }>('/delivery/calculate-fee', {
            cartSubtotal: get().subtotal(),
            customerLat: lat,
            customerLng: lng,
          });
          set({
            deliveryFee: res.data.data.fee,
            deliveryReason: res.data.data.reason,
          });
        } catch {
          // keep current fee
        }
      },
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({ items: state.items }),
      // Phase 6 cart shape diverged from the legacy variantId-keyed
      // entries — purge any persisted item that doesn't have a productId
      // so we never render half-shaped rows after the upgrade.
      migrate: (persistedState, _version) => {
        const state = persistedState as { items?: unknown };
        if (!state || !Array.isArray(state.items)) return { items: [] };
        const items = (state.items as Array<Record<string, unknown>>).filter(
          (i) => typeof i.productId === 'string' && typeof i.quantity === 'number',
        );
        return { items: items as unknown as CartItem[] };
      },
      version: 1,
    }
  )
);
