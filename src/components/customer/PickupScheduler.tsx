'use client';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { CalendarClock, Clock, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

export interface PublicSettings {
  futurePickupEnabled: boolean;
  maxReservationDays: number;
  cutoffTime: string | null;
  slotCount: number;
}

interface SlotAvailability {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  available: boolean;
  reason: 'FULL' | 'PAST_TIME' | 'INACTIVE' | 'CUTOFF' | 'DISABLED' | null;
}

interface AvailabilityResult {
  enabled: boolean;
  date: string;
  range: { firstDate: string; lastDate: string };
  slots: SlotAvailability[];
  reason?: 'DISABLED' | 'OUT_OF_RANGE';
}

export interface PickupSchedule {
  pickupType: 'ASAP' | 'SCHEDULED';
  scheduledPickupDate?: string;
  scheduledPickupSlotId?: string;
}

interface Props {
  value: PickupSchedule;
  onChange: (next: PickupSchedule) => void;
  /**
   * Pickup feature flags, sourced from the checkout page's unified
   * `POST /checkout/prepare` response (`fulfillment.pickupSettings`) —
   * this component no longer fetches `/pickup/public-settings` itself.
   * `null`/`undefined` while checkout hasn't resolved it yet, or when
   * pickup currently isn't an available fulfillment option.
   */
  settings: PublicSettings | null | undefined;
}

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatHHMMtoLocal(time: string): string {
  // "20:00" → "8:00 PM"; falls back to the raw string if parsing fails.
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return time;
  const h = Number(m[1]);
  const mm = m[2];
  const period = h >= 12 ? 'PM' : 'AM';
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hh}:${mm} ${period}`;
}

/**
 * Customer-facing pickup scheduler.
 *
 * - Reads the admin settings + slot list lazily.
 * - When `Pickup Today` is selected, no extra fields are sent — order falls
 *   back to ASAP.
 * - When `Schedule Pickup` is selected, the user picks a date inside the
 *   admin-allowed range and an available slot. Disabled slots show why
 *   (full, past, cutoff, inactive).
 *
 * The scheduler self-hides if the feature is disabled OR no slots exist —
 * checkout silently behaves as today-only pickup.
 */
export function PickupScheduler({ value, onChange, settings }: Props) {
  const t = useTranslations();

  const today = useMemo(() => ymd(new Date()), []);
  const selectedDate = value.scheduledPickupDate ?? today;

  const featureUsable = Boolean(
    settings && settings.futurePickupEnabled && settings.slotCount > 0,
  );

  // Only fetch availability when the schedule mode is open AND the feature
  // is actually usable. Hook always runs (passes a null key to skip).
  const fetchUrl =
    featureUsable && value.pickupType === 'SCHEDULED'
      ? `/checkout/pickup-slots?date=${selectedDate}`
      : null;
  const { data: availability } = useSWR<AvailabilityResult>(fetchUrl, fetcher);

  // Keep parent value consistent when the feature becomes unavailable.
  useEffect(() => {
    if (settings && !featureUsable && value.pickupType !== 'ASAP') {
      onChange({ pickupType: 'ASAP' });
    }
  }, [settings, featureUsable, value.pickupType, onChange]);

  const maxDate = useMemo(() => {
    const days = settings?.maxReservationDays ?? 0;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return ymd(d);
  }, [settings?.maxReservationDays]);

  // Render nothing until settings load and only when the feature is on.
  // All hooks above run unconditionally — the early-return is hook-safe.
  if (!settings || !featureUsable) return null;

  const handleSelectDate = (date: string) => {
    onChange({
      pickupType: 'SCHEDULED',
      scheduledPickupDate: date,
      // Reset slot when date changes — must pick from the new day's slots.
      scheduledPickupSlotId: undefined,
    });
  };

  const handleSelectSlot = (slotId: string) => {
    onChange({
      pickupType: 'SCHEDULED',
      scheduledPickupDate: selectedDate,
      scheduledPickupSlotId: slotId,
    });
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-brand-500" />
        <p className="font-semibold text-gray-900">{t('checkout.pickupTiming')}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ModeButton
          active={value.pickupType === 'ASAP'}
          title={t('checkout.pickupToday')}
          subtitle={t('checkout.pickupTodayHint')}
          onClick={() => onChange({ pickupType: 'ASAP' })}
        />
        <ModeButton
          active={value.pickupType === 'SCHEDULED'}
          title={t('checkout.schedulePickup')}
          subtitle={t('checkout.schedulePickupHint')}
          onClick={() => onChange({
            pickupType: 'SCHEDULED',
            scheduledPickupDate: value.scheduledPickupDate ?? today,
          })}
        />
      </div>

      {value.pickupType === 'SCHEDULED' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {t('checkout.pickupDate')}
            </label>
            <input
              type="date"
              value={selectedDate}
              min={today}
              max={maxDate}
              onChange={(e) => handleSelectDate(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <p className="text-[11px] text-gray-400">
              {t('checkout.pickupDateRangeHint', {
                from: today,
                to: maxDate,
              })}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {t('checkout.pickupSlot')}
            </label>
            {availability?.reason === 'OUT_OF_RANGE' ? (
              <SlotMessage icon><span>{t('checkout.slotOutOfRange')}</span></SlotMessage>
            ) : availability && availability.slots.length === 0 ? (
              <SlotMessage icon><span>{t('checkout.noSlotsForDate')}</span></SlotMessage>
            ) : !availability ? (
              <p className="text-xs text-gray-400 py-2">{t('common.loading')}</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {availability.slots.map((slot) => {
                  const selected = value.scheduledPickupSlotId === slot.id;
                  const disabled = !slot.available;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleSelectSlot(slot.id)}
                      className={cn(
                        'flex items-center justify-between rounded-xl border px-3 py-2.5 text-start transition-colors',
                        selected
                          ? 'border-brand-500 bg-brand-50'
                          : disabled
                            ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                            : 'border-gray-200 bg-white hover:border-brand-300'
                      )}
                    >
                      <div>
                        <p className={cn(
                          'text-sm font-semibold',
                          selected ? 'text-brand-700' : 'text-gray-900'
                        )}>
                          <span dir="ltr">
                            {formatHHMMtoLocal(slot.startTime)} – {formatHHMMtoLocal(slot.endTime)}
                          </span>
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {slot.available
                            ? t('checkout.slotSeatsLeft', { count: slot.capacity - slot.bookedCount })
                            : slot.reason === 'FULL' ? t('checkout.slotFull')
                            : slot.reason === 'PAST_TIME' ? t('checkout.slotPast')
                            : slot.reason === 'CUTOFF' ? t('checkout.slotCutoff')
                            : t('checkout.slotUnavailable')}
                        </p>
                      </div>
                      <Clock className="h-4 w-4 text-gray-400" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active, title, subtitle, onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-2xl border p-3 text-start transition-colors',
        active
          ? 'border-brand-500 bg-brand-50'
          : 'border-gray-200 bg-white hover:border-brand-300'
      )}
    >
      <p className={cn('text-sm font-semibold', active ? 'text-brand-700' : 'text-gray-900')}>
        {title}
      </p>
      <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>
    </button>
  );
}

function SlotMessage({ icon, children }: { icon?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
      {icon && <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />}
      <p className="text-xs text-amber-700 leading-snug">{children}</p>
    </div>
  );
}
