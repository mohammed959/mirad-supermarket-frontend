'use client';
import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import { RefreshCw, X, User, Search, Calendar, Car } from 'lucide-react';
import api from '@/lib/api';
import { Order, OrderStatus, Pagination } from '@/types';
import { orderStatusColor, formatPrice, timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { FulfillmentBadge } from '@/components/common/FulfillmentBadge';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

type TabKey = 'today' | 'other' | 'future';

interface OrdersResponse {
  orders: Order[];
  pagination: Pagination;
  range?: { fromDate: string; toDate: string };
}

// Frontend filter keys. 'PAYMENT_REVIEW' is a meta-filter that sends
// `paymentStatus=UNDER_REVIEW` instead of an OrderStatus value.
type StatusFilter =
  | ''
  | 'NEW'
  | 'PAYMENT_REVIEW'
  | 'ASSIGNED_TO_PICKER'
  | 'PICKING_IN_PROGRESS'
  | 'READY_FOR_DELIVERY'
  | 'ASSIGNED_TO_DRIVER'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CONFIRMED'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP_BY_CUSTOMER'
  | 'COMPLETED'
  | 'CANCELLED';

const STATUS_FILTERS: { key: StatusFilter; labelKey: string }[] = [
  { key: '',                       labelKey: 'common.viewAll' },
  { key: 'NEW',                    labelKey: 'statuses.NEW' },
  { key: 'PAYMENT_REVIEW',         labelKey: 'admin.paymentReview' },
  { key: 'ASSIGNED_TO_PICKER',     labelKey: 'statuses.ASSIGNED_TO_PICKER' },
  { key: 'PICKING_IN_PROGRESS',    labelKey: 'statuses.PICKING_IN_PROGRESS' },
  { key: 'READY_FOR_DELIVERY',     labelKey: 'statuses.READY_FOR_DELIVERY' },
  { key: 'ASSIGNED_TO_DRIVER',     labelKey: 'statuses.ASSIGNED_TO_DRIVER' },
  { key: 'OUT_FOR_DELIVERY',       labelKey: 'statuses.OUT_FOR_DELIVERY' },
  { key: 'DELIVERED',              labelKey: 'statuses.DELIVERED' },
  { key: 'CONFIRMED',              labelKey: 'statuses.CONFIRMED' },
  { key: 'READY_FOR_PICKUP',       labelKey: 'statuses.READY_FOR_PICKUP' },
  { key: 'PICKED_UP_BY_CUSTOMER',  labelKey: 'statuses.PICKED_UP_BY_CUSTOMER' },
  { key: 'COMPLETED',              labelKey: 'statuses.COMPLETED' },
  { key: 'CANCELLED',              labelKey: 'statuses.CANCELLED' },
];

function buildStatusParams(status: StatusFilter): Record<string, string> {
  if (!status) return {};
  if (status === 'PAYMENT_REVIEW') return { paymentStatus: 'UNDER_REVIEW' };
  return { status };
}

function todayYmd(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function useDebounced<T>(value: T, ms = 300): [T, () => void] {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  // Caller-triggered flush — used by the search input so a barcode scanner
  // pressing Enter forces the search immediately instead of waiting for the
  // debounce window.
  const flush = () => setV(value);
  return [v, flush];
}

export default function AdminOrdersPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const customerId = searchParams.get('customerId') ?? '';

  const [tab, setTab] = useState<TabKey>('today');

  // Track whether Other / Future Orders have been opened at least once. SWR
  // only fetches those endpoints after the admin opens the corresponding tab,
  // satisfying the "don't load historical/future orders by default" requirement.
  const [otherOpened, setOtherOpened] = useState(false);
  const [futureOpened, setFutureOpened] = useState(false);

  useEffect(() => {
    if (tab === 'other' && !otherOpened) setOtherOpened(true);
    if (tab === 'future' && !futureOpened) setFutureOpened(true);
  }, [tab, otherOpened, futureOpened]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.orders')}</h1>
      </div>

      {customerId && (
        <CustomerScopeBanner
          customerId={customerId}
          onClear={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('customerId');
            router.replace(`/admin/orders${params.toString() ? `?${params}` : ''}`);
          }}
        />
      )}

      <div className="flex gap-2 border-b border-gray-200">
        <TabButton active={tab === 'today'} onClick={() => setTab('today')}>
          {t('admin.ordersTabToday')}
        </TabButton>
        <TabButton active={tab === 'other'} onClick={() => setTab('other')}>
          {t('admin.ordersTabOther')}
        </TabButton>
        <TabButton active={tab === 'future'} onClick={() => setTab('future')}>
          {t('admin.ordersTabFuture')}
        </TabButton>
      </div>

      {/* Today panel — mounted always so its SWR cache persists when tab switches. */}
      <div className={cn(tab === 'today' ? 'block' : 'hidden')}>
        <TodayPanel customerId={customerId} />
      </div>

      {/* Other panel — only mounts on first activation. */}
      <div className={cn(tab === 'other' ? 'block' : 'hidden')}>
        {otherOpened ? <OtherPanel customerId={customerId} /> : null}
      </div>

      {/* Future panel — only mounts on first activation. */}
      <div className={cn(tab === 'future' ? 'block' : 'hidden')}>
        {futureOpened ? <FuturePanel customerId={customerId} /> : null}
      </div>
    </div>
  );
}

// ─── Customer-scope banner ───────────────────────────────────────────

function CustomerScopeBanner({ customerId, onClear }: { customerId: string; onClear: () => void }) {
  const { data: customerInfo } = useSWR<{ id: string; mobile: string; name: string | null }>(
    `/users/${customerId}`,
    fetcher
  );
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-3 py-2">
      <User className="h-4 w-4 text-brand-600" />
      <span className="text-sm text-brand-700">
        Filtering orders for{' '}
        <span className="font-semibold">{customerInfo?.name || customerInfo?.mobile || 'customer'}</span>
      </span>
      <button
        onClick={onClear}
        className="ms-auto inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
      >
        <X className="h-3 w-3" /> Clear filter
      </button>
    </div>
  );
}

function TabButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative px-4 py-2.5 text-sm font-semibold transition-colors',
        active ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'
      )}
    >
      {children}
      <span
        className={cn(
          'absolute bottom-0 left-0 right-0 h-0.5 rounded-t',
          active ? 'bg-brand-500' : 'bg-transparent'
        )}
      />
    </button>
  );
}

// ─── Today panel ─────────────────────────────────────────────────────

function TodayPanel({ customerId }: { customerId: string }) {
  const t = useTranslations();
  const [status, setStatus] = useState<StatusFilter>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [debouncedSearch, flushSearch] = useDebounced(search, 300);
  useEffect(() => setPage(1), [status, debouncedSearch, customerId]);

  const params = useMemo(() => {
    const p = new URLSearchParams({
      page: String(page),
      limit: '20',
      ...buildStatusParams(status),
      ...(debouncedSearch.trim() && { search: debouncedSearch.trim() }),
      ...(customerId && { customerId }),
    });
    return p.toString();
  }, [page, status, debouncedSearch, customerId]);

  const { data, isLoading, isValidating, mutate } = useSWR<OrdersResponse>(
    `/orders/admin/today?${params}`,
    fetcher,
    { refreshInterval: 20000 }
  );

  return (
    <div className="space-y-4">
      <FilterBar
        status={status}
        onStatus={setStatus}
        search={search}
        onSearch={setSearch}
        onSearchEnter={flushSearch}
        right={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => mutate()}
            loading={isValidating && !isLoading}
          >
            <RefreshCw className="h-4 w-4" />
            {t('admin.refreshToday')}
          </Button>
        }
      />

      <OrdersTable
        loading={isLoading}
        orders={data?.orders ?? []}
        pagination={data?.pagination}
        page={page}
        onPage={setPage}
        emptyTitle={
          debouncedSearch.trim() ? t('admin.noOrderForBarcode') : t('admin.noOrdersToday')
        }
      />
    </div>
  );
}

// ─── Other panel ─────────────────────────────────────────────────────

function OtherPanel({ customerId }: { customerId: string }) {
  const t = useTranslations();
  const [status, setStatus] = useState<StatusFilter>('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState<string>(() => todayYmd(-3));
  const [toDate, setToDate] = useState<string>(() => todayYmd(-1));
  const [page, setPage] = useState(1);

  const [debouncedSearch, flushSearch] = useDebounced(search, 300);
  useEffect(() => setPage(1), [status, debouncedSearch, fromDate, toDate, customerId]);

  const params = useMemo(() => {
    const p = new URLSearchParams({
      page: String(page),
      limit: '20',
      ...buildStatusParams(status),
      ...(debouncedSearch.trim() && { search: debouncedSearch.trim() }),
      ...(customerId && { customerId }),
      ...(fromDate && { fromDate }),
      ...(toDate && { toDate }),
    });
    return p.toString();
  }, [page, status, debouncedSearch, fromDate, toDate, customerId]);

  const { data, isLoading } = useSWR<OrdersResponse>(
    `/orders/admin/other?${params}`,
    fetcher
  );

  // Reflect server's clamped range (to never include today) back to the inputs
  // so the user sees what the backend actually queried.
  useEffect(() => {
    if (!data?.range) return;
    if (data.range.toDate !== toDate && data.range.toDate < todayYmd(0)) {
      setToDate(data.range.toDate);
    }
  }, [data?.range, toDate]);

  return (
    <div className="space-y-4">
      <FilterBar
        status={status}
        onStatus={setStatus}
        search={search}
        onSearch={setSearch}
        onSearchEnter={flushSearch}
        right={null}
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-100 bg-white px-3 py-2.5">
        <Calendar className="h-4 w-4 text-gray-400 mt-2" />
        <DateInput label={t('admin.from')} value={fromDate} onChange={setFromDate} max={todayYmd(-1)} />
        <DateInput label={t('admin.to')}   value={toDate}   onChange={setToDate}   max={todayYmd(-1)} />
        <p className="text-[11px] text-gray-400 ms-auto">{t('admin.otherDateHint')}</p>
      </div>

      <OrdersTable
        loading={isLoading}
        orders={data?.orders ?? []}
        pagination={data?.pagination}
        page={page}
        onPage={setPage}
        emptyTitle={
          debouncedSearch.trim() ? t('admin.noOrderForBarcode') : t('admin.noOtherOrders')
        }
      />
    </div>
  );
}

function DateInput({
  label, value, onChange, min, max,
}: { label: string; value: string; onChange: (v: string) => void; min?: string; max?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
    </label>
  );
}

// ─── Future panel ────────────────────────────────────────────────────

interface PickupSlotLite { id: string; label: string; startTime: string; endTime: string }

function FuturePanel({ customerId }: { customerId: string }) {
  const t = useTranslations();
  const [status, setStatus] = useState<StatusFilter>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pickupSlotId, setPickupSlotId] = useState<string>('');
  // Default range: tomorrow → +7 days.
  const [fromDate, setFromDate] = useState<string>(() => todayYmd(1));
  const [toDate, setToDate] = useState<string>(() => todayYmd(7));

  const [debouncedSearch, flushSearch] = useDebounced(search, 300);
  useEffect(() => setPage(1), [status, debouncedSearch, fromDate, toDate, pickupSlotId, customerId]);

  // Load active pickup slots for the filter dropdown. Lazy with SWR.
  const { data: slots } = useSWR<PickupSlotLite[]>('/pickup/slots', fetcher);

  const params = useMemo(() => {
    const p = new URLSearchParams({
      page: String(page),
      limit: '20',
      ...buildStatusParams(status),
      ...(debouncedSearch.trim() && { search: debouncedSearch.trim() }),
      ...(customerId && { customerId }),
      ...(fromDate && { fromDate }),
      ...(toDate && { toDate }),
      ...(pickupSlotId && { pickupSlotId }),
    });
    return p.toString();
  }, [page, status, debouncedSearch, fromDate, toDate, pickupSlotId, customerId]);

  const { data, isLoading } = useSWR<OrdersResponse>(
    `/orders/admin/future?${params}`,
    fetcher,
  );

  return (
    <div className="space-y-4">
      <FilterBar
        status={status}
        onStatus={setStatus}
        search={search}
        onSearch={setSearch}
        onSearchEnter={flushSearch}
        right={null}
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-100 bg-white px-3 py-2.5">
        <Calendar className="h-4 w-4 text-gray-400 mt-2" />
        <DateInput label={t('admin.from')} value={fromDate} onChange={setFromDate} min={todayYmd(1)} />
        <DateInput label={t('admin.to')}   value={toDate}   onChange={setToDate}   min={todayYmd(1)} />
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            {t('admin.pickupSlot')}
          </span>
          <select
            value={pickupSlotId}
            onChange={(e) => setPickupSlotId(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            <option value="">{t('common.viewAll')}</option>
            {(slots ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <p className="text-[11px] text-gray-400 ms-auto">{t('admin.futureDateHint')}</p>
      </div>

      <OrdersTable
        loading={isLoading}
        orders={data?.orders ?? []}
        pagination={data?.pagination}
        page={page}
        onPage={setPage}
        emptyTitle={
          debouncedSearch.trim() ? t('admin.noOrderForBarcode') : t('admin.noFutureOrders')
        }
        showScheduledPickup
      />
    </div>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────

function FilterBar({
  status, onStatus, search, onSearch, onSearchEnter, right,
}: {
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  search: string;
  onSearch: (s: string) => void;
  /** Called when the input receives Enter (barcode scanner end-of-scan). */
  onSearchEnter: () => void;
  right: React.ReactNode;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSearchEnter();
              }
            }}
            // Selecting on focus makes a scanner's next scan replace the
            // previous order number without the admin clearing the field.
            onFocus={(e) => e.currentTarget.select()}
            placeholder={t('admin.orderSearchPlaceholder')}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 ps-9 pe-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {right}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key || 'all'}
            onClick={() => onStatus(f.key)}
            className={cn(
              'shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors',
              status === f.key
                ? 'bg-brand-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'
            )}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}

function OrdersTable({
  loading, orders, pagination, page, onPage, emptyTitle, showScheduledPickup,
}: {
  loading: boolean;
  orders: Order[];
  pagination: Pagination | undefined;
  page: number;
  onPage: (n: number) => void;
  emptyTitle: string;
  /** Add a "Scheduled pickup" column (used by the Future Orders panel). */
  showScheduledPickup?: boolean;
}) {
  const t = useTranslations();

  if (loading) return <Skeleton className="h-64 rounded-2xl" />;
  if (orders.length === 0) return <EmptyState title={emptyTitle} />;

  return (
    <div className="rounded-2xl bg-white border border-gray-100 overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="border-b border-gray-100 bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('orders.order')}</th>
            <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('admin.customer')}</th>
            <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('admin.status')}</th>
            {showScheduledPickup && (
              <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('admin.scheduledPickup')}</th>
            )}
            <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 uppercase tracking-wide">Picker</th>
            <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 uppercase tracking-wide">Driver</th>
            <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('admin.total')}</th>
            <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('admin.time')}</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-mono font-semibold text-gray-900">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>{order.orderNumber}</span>
                  <FulfillmentBadge type={order.fulfillmentType} />
                  {(order.carPlateNumber || order.carBrand || order.carColor || order.pickupCustomerNote) && (
                    <span
                      className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700"
                      title={order.carPlateNumber ?? t('admin.carPickupBadge')}
                    >
                      <Car className="h-3 w-3" />
                      {order.carPlateNumber ?? t('admin.carPickupBadge')}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600 font-mono text-xs" dir="ltr">{order.customer?.mobile ?? '—'}</td>
              <td className="px-4 py-3">
                <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${orderStatusColor(order.status)}`}>
                  {t(`statuses.${order.status}`)}
                </span>
              </td>
              {showScheduledPickup && (
                <td className="px-4 py-3 text-xs">
                  {order.scheduledPickupDate ? (
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-800">
                        {new Date(order.scheduledPickupDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}
                      </span>
                      <span className="text-[11px] text-gray-500 font-mono" dir="ltr">
                        {order.scheduledPickupStartTime} – {order.scheduledPickupEndTime}
                      </span>
                    </div>
                  ) : <span className="text-gray-400">—</span>}
                </td>
              )}
              <td className="px-4 py-3 text-xs">
                {order.picker
                  ? <span className="font-medium text-gray-800">{order.picker.name || order.picker.mobile}</span>
                  : <span className="text-gray-400">Unassigned</span>}
              </td>
              <td className="px-4 py-3 text-xs">
                {order.driver
                  ? <span className="font-medium text-gray-800">{order.driver.name || order.driver.mobile}</span>
                  : <span className="text-gray-400">Unassigned</span>}
              </td>
              <td className="px-4 py-3 font-semibold text-gray-900">{formatPrice(order.total)}</td>
              <td className="px-4 py-3 text-gray-500">{timeAgo(order.createdAt)}</td>
              <td className="px-4 py-3">
                <Link href={`/admin/orders/${order.id}`} className="text-brand-600 text-xs font-semibold hover:underline">
                  {t('admin.view')}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-xs text-gray-500">{pagination.total}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => onPage(page - 1)}>
              {t('common.previous')}
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= pagination.pages} onClick={() => onPage(page + 1)}>
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
