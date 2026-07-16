import type { HomeProductCard, Product } from '../types';

/**
 * Pure adapter from the aggregate `HomeProductCard` wire shape to the
 * broad legacy `Product` shape the existing `<ProductCard>` component
 * consumes.
 *
 * Split into its own file (no axios / no path-alias imports) so the
 * function can be unit-tested with Node's built-in `--experimental-
 * strip-types` runner without dragging axios into the test.
 *
 * Stock / reserved policy
 * ───────────────────────
 * The aggregate API deliberately does NOT carry exact inventory — it
 * guarantees only `available: boolean`. To avoid misrepresenting stock
 * we set `stock` and `reserved` to `null` here. `<ProductCard>` treats
 * both-null as the "unknown max" signal and hides the exact-cap from
 * `<QuantityStepper>`. The backend remains authoritative — checkout
 * still validates real stock server-side.
 *
 * Explicitly REJECTED alternatives (per Step 6 hardening):
 *   - A magic ceiling constant fabricates inventory that does not exist
 *     on the wire.
 *   - A sentinel number would have the same problem, harder to grep.
 *
 * `available` is forwarded verbatim so `productAvailable()` never falls
 * back to the stock/isActive branch. `category` / `variants` / `brand`
 * are stub / empty; they are not read by `<ProductCard>` or the
 * add-to-cart path.
 */

export function aggregateCardToProduct(card: HomeProductCard): Product {
  return {
    id: card.id,
    name: card.name,
    nameAr: card.nameAr,
    description: null,
    descriptionAr: null,
    imageUrl: card.imageUrl,
    sku: card.sku,
    barcode: null,
    price: card.price,
    stock: null,
    reserved: null,
    isFeatured: false,
    isActive: true,
    category: { id: '', name: '', nameAr: '' },
    subcategory: null,
    brand: null,
    variants: [],
    available: card.available,
  };
}
