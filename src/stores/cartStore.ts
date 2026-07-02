import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem, Product } from '@/types';
import api from '@/lib/api';

interface DeliveryFeeResult {
  fee: number;
  distanceKm: number | null;
  reason: string;
}

interface CartState {
  items: CartItem[];
  deliveryFee: number;
  deliveryReason: string;
  isOpen: boolean;

  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  /**
   * Phase 6: the only marketplace add-to-basket entry point. Reads
   * product-level price; tracks the basket line under `productId`.
   */
  addProduct: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;

  setItemsFromReorder: (items: CartItem[]) => void;
  mergeOnLogin: () => Promise<void>;

  subtotal: () => number;
  itemCount: () => number;
  total: () => number;

  fetchDeliveryFee: (lat?: number, lng?: number) => Promise<void>;
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

      addProduct: (product) => {
        get().addItem({
          productId: product.id,
          productName: product.name,
          productNameAr: product.nameAr,
          productImage: product.imageUrl,
          price: Number(product.price ?? 0),
        });
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((i) => i.productId !== productId) });
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.productId === productId ? { ...i, quantity } : i
          ),
        });
      },

      clearCart: () => set({ items: [] }),

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      // Replace the cart wholesale (used by reorder flow). The reorder
      // backend already emits product-keyed items, so we just trust them.
      setItemsFromReorder: (items) => set({ items }),

      // Hook invoked after login. Today the cart is purely client-side, so we
      // just retain the existing guest cart. Hook reserved for future server
      // cart sync / stock re-validation.
      mergeOnLogin: async () => {
        return;
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
