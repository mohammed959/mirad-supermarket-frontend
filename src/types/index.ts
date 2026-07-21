export type Role = 'CUSTOMER' | 'SUPER_ADMIN' | 'PICKER' | 'DRIVER';
export type VariantType = 'PIECE' | 'CARTON' | 'DOZEN' | 'BUNDLE';
export type OrderStatus =
  | 'NEW' | 'PAYMENT_VERIFIED' | 'ASSIGNED_TO_PICKER' | 'PICKING_IN_PROGRESS'
  | 'READY_FOR_DELIVERY' | 'READY_FOR_PICKUP'
  | 'ASSIGNED_TO_DRIVER' | 'OUT_FOR_DELIVERY'
  | 'DELIVERED' | 'PICKED_UP_BY_CUSTOMER' | 'COMPLETED'
  | 'CONFIRMED' | 'CANCELLED' | 'REJECTED';
export type FulfillmentType = 'DELIVERY' | 'PICKUP';
export type PaymentMethod = 'CASH_ON_DELIVERY' | 'BANK_TRANSFER' | 'PAY_AT_BRANCH';
export type PaymentStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
export type NotificationType =
  | 'ORDER_STATUS_CHANGED' | 'ORDER_ASSIGNED'
  | 'SUBSCRIPTION_ACTIVATED' | 'SUBSCRIPTION_EXPIRING' | 'PROMOTION_ACTIVATED';

export interface User {
  id: string;
  mobile: string | null;
  email: string | null;
  username: string | null;
  name: string | null;
  nameAr: string | null;
  role: Role;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  showOnHome: boolean;
  subcategories: Subcategory[];
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  nameAr: string;
  slug: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductVariant {
  id: string;
  productId: string;
  type: VariantType;
  sku: string;
  barcode: string | null;
  price: number;
  stock: number;
  reserved: number;
  isActive: boolean;
  available?: boolean;
}

export interface Brand {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  imageUrl?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface Product {
  id: string;
  name: string;
  nameAr: string;
  description: string | null;
  descriptionAr?: string | null;
  imageUrl: string | null;
  // Flat product-level commerce fields (Phase 1+). Legacy products may still
  // have nulls until backfill runs; the admin UI enforces values for new
  // products via Zod on the backend.
  sku: string | null;
  barcode: string | null;
  price: number | string | null;
  // `stock` / `reserved` are `null` when the emitting endpoint does not
  // carry exact inventory (e.g. the storefront homepage aggregate, which
  // only guarantees `available: boolean`). Every existing consumer uses
  // `?? 0` on these fields, so widening to nullable is backward-safe;
  // <ProductCard> uses the null signal to render an "unknown max"
  // QuantityStepper instead of fabricating a client-side cap.
  stock: number | null;
  reserved: number | null;
  isFeatured: boolean;
  isActive: boolean;
  hideFromHome?: boolean;
  category: { id: string; name: string; nameAr: string; slug?: string };
  subcategory: { id: string; name: string; nameAr: string; slug?: string } | null;
  brand: Brand | null;
  // Legacy: still emitted by some endpoints for backwards-compat. Phase 4+
  // drops the field from customer-facing responses entirely. Kept required
  // (defaulting to []) so existing customer-side code type-checks until
  // Phase 4 rewrites it.
  variants: ProductVariant[];
  available?: boolean;
}

export interface CartItem {
  productId: string;
  productName: string;
  /** Arabic name snapshot so the basket follows the site language. Optional
   *  for backward-compat with carts persisted before this field existed. */
  productNameAr?: string | null;
  productImage: string | null;
  price: number;
  quantity: number;
}

export interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  total: number;
  isFreeItem: boolean;
  status?: OrderItemStatus;
  replacedByItemId?: string | null;
  notes?: string | null;
  // Phase 6: new flat product-level fields. Backend always populates
  // `product` (either from the productId FK or by deriving it from
  // legacy variant.product). `variant` is preserved for picker/driver
  // workflows that haven't been retired yet.
  productId?: string | null;
  productSku?: string | null;
  productBarcode?: string | null;
  productName?: string | null;
  productNameAr?: string | null;
  product?: {
    id: string;
    name: string;
    nameAr: string;
    imageUrl: string | null;
    sku?: string | null;
    barcode?: string | null;
  } | null;
  // Backend always emits `variant` — for legacy orders it's the real
  // variant row; for new flat orders it's synthesized from product
  // fields so picker / driver / admin UIs keep working without code
  // changes. `sku` is included so customer order-detail can show it
  // without a separate lookup.
  variant: {
    id: string;
    type: VariantType;
    sku: string;
    price: number;
    product: {
      id: string;
      name: string;
      nameAr: string;
      imageUrl: string | null;
      sku?: string | null;
      barcode?: string | null;
    };
  };
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subscriptionApplied?: boolean;
  paymentProofUrl: string | null;
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  total: number;
  notes: string | null;
  replacementPreference: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  distanceKm: number | null;
  deliveryImages?: string[] | null;
  pickupType?: 'ASAP' | 'SCHEDULED' | null;
  scheduledPickupDate?: string | null;
  scheduledPickupStartTime?: string | null;
  scheduledPickupEndTime?: string | null;
  scheduledPickupSlotId?: string | null;
  pickupSlot?: { id: string; label: string; startTime: string; endTime: string } | null;
  carPlateNumber?: string | null;
  carBrand?: string | null;
  carColor?: string | null;
  pickupCustomerNote?: string | null;
  driverConfirmedAt?: string | null;
  createdAt: string;
  customer?: { id: string; name: string | null; mobile: string };
  driver?: { id: string; name: string | null; mobile?: string } | null;
  picker?: { id: string; name: string | null; mobile?: string } | null;
  address?: CustomerAddress | null;
  items: OrderItem[];
  statusHistory: { id: string; status: OrderStatus; note: string | null; createdAt: string }[];
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  label: string;
  addressLine: string | null;
  city: string | null;
  deliveryNotes?: string | null;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  orderId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface ReorderResult {
  items: Array<{
    productId: string;
    productName: string;
    productNameAr?: string | null;
    productImage: string | null;
    price: number;
    quantity: number;
    priceChanged: boolean;
    originalPrice: number;
  }>;
  skipped: Array<{
    productName: string;
    quantity: number;
    reason: string;
  }>;
}

export interface BuyAgainEntry {
  product: Product;
  orderCount: number;
}

export interface SearchResult {
  products: Product[];
  matchedProductId: string | null;
  pagination?: Pagination;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  nameAr: string;
  price: number;
  durationDays: number;
  benefitType: 'FREE_DELIVERY' | 'DISCOUNTED_DELIVERY' | 'CAPPED_DELIVERY';
  discountValue: number | null;
  cappedFee: number | null;
  maxFreeDeliveries: number | null;
}

export interface CustomerSubscription {
  id: string;
  status: 'PENDING_PAYMENT' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  expiryDate: string;
  deliveriesUsed: number;
  plan: SubscriptionPlan;
}

export interface Banner {
  id: string;
  title: string;
  titleAr: string;
  imageUrl: string;
  linkType: string | null;
  linkValue: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface FeaturedSectionItem {
  id: string;
  sectionId: string;
  productId: string;
  sortOrder: number;
  product: Product;
}

export interface FeaturedSection {
  id: string;
  name: string;
  nameAr: string;
  sortOrder: number;
  isActive: boolean;
  items: FeaturedSectionItem[];
}

export type OrderItemStatus = 'PENDING' | 'PICKED' | 'UNAVAILABLE' | 'REPLACED' | 'REMOVED';

export type PromotionType =
  | 'BUY_X_GET_Y'
  | 'VARIANT_DISCOUNT'
  | 'PRODUCT_DISCOUNT'
  | 'CATEGORY_DISCOUNT'
  | 'FREE_DELIVERY_THRESHOLD'
  | 'SUBSCRIPTION_BASED_DISCOUNT';

export type TargetScope =
  | 'ALL'
  | 'PRODUCT'
  | 'VARIANT'
  | 'CATEGORY'
  | 'SUBCATEGORY';

export interface Promotion {
  id: string;
  name: string;
  nameAr: string;
  description: string | null;
  descriptionAr: string | null;
  type: PromotionType;
  isActive: boolean;
  isStackable: boolean;
  priority: number;
  startDate: string;
  endDate: string | null;
  minimumCartValue: number | string | null;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  usageCount: number;
  requiresSubscription: boolean;
  targetScope: TargetScope;
  config: Record<string, unknown>;
  archivedAt: string | null;
  targetProducts?: { id: string; name: string }[];
  targetCategories?: { id: string; name: string }[];
  targetVariants?: { id: string; sku: string }[];
  targetSubcategories?: { id: string; name: string }[];
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: unknown;
  createdAt: string;
  actor: { id: string; name: string | null; mobile: string; role: Role } | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  // New ninja-style fields exposed alongside the legacy keys above.
  pageSize?: number;
  totalItems?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface HomeSettings {
  id: string;
  // Number of products shown in the homepage "All Products" strip.
  allProductsLimit: number;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────
// Storefront homepage aggregation (GET /api/storefront/home)
//
// These types mirror the backend wire contract EXACTLY. Do NOT reuse
// the broad legacy `Product` type here — the aggregate returns only
// what strips need to render (id/name/sku/imageUrl/price/available),
// so mixing in `category`/`stock`/`variants`/`brand` would misrepresent
// what's actually present on the wire.
// ─────────────────────────────────────────────────────────────────

export interface HomeProductCard {
  id: string;
  name: string;
  nameAr: string;
  sku: string | null;
  imageUrl: string;
  price: string | null;
  available: boolean;
}

export interface HomeSubcategoryCard {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  imageUrl: string;
  sortOrder: number;
}

export interface HomeCategoryCard {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  imageUrl: string;
  sortOrder: number;
  subCategories: HomeSubcategoryCard[];
}

export interface HomeBanner {
  id: string;
  title: string;
  titleAr: string;
  imageUrl: string;
  linkType: string | null;
  linkValue: string | null;
  sortOrder: number;
}

export interface HomeFeaturedSection {
  id: string;
  name: string;
  nameAr: string;
  sortOrder: number;
  products: HomeProductCard[];
}

export interface HomeAllProducts {
  items: HomeProductCard[];
  hasMore: boolean;
}

export interface HomeAggregate {
  categories: HomeCategoryCard[];
  banners: HomeBanner[];
  featuredProducts: HomeProductCard[];
  featuredSections: HomeFeaturedSection[];
  allProducts: HomeAllProducts;
}
