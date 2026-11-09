import { ApplicationRef, Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { VehicleService } from './vehicle.service';
import type { Vehicle } from '../models/vehicle.model';

const SAVED_KEY = 'dl.saved';
const COMPARE_KEY = 'dl.compare';
const RECENT_KEY = 'dl.recent';

export const COMPARE_LIMIT = 3;
const RECENT_LIMIT = 8;

/**
 * The buyer's own "garage": saved cars, a compare list and recently viewed cars.
 * Kept in this browser only (localStorage), so nothing is sent anywhere.
 */
@Injectable({ providedIn: 'root' })
export class GarageService {
  private readonly vehicles = inject(VehicleService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  // Start empty so the first browser render matches the prerendered HTML;
  // the stored lists are loaded once hydration is complete.
  readonly savedIds = signal<string[]>([]);
  readonly compareIds = signal<string[]>([]);
  readonly recentIds = signal<string[]>([]);
  private loaded = false;

  /** Short message for the toast after an action ("Saved", "Compare is full"…). */
  readonly notice = signal<string | null>(null);
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  readonly savedVehicles = computed(() => this.resolve(this.savedIds()));
  readonly compareVehicles = computed(() => this.resolve(this.compareIds()));
  readonly recentVehicles = computed(() => this.resolve(this.recentIds()));

  readonly savedCount = computed(() => this.savedVehicles().length);
  readonly compareCount = computed(() => this.compareVehicles().length);

  constructor() {
    if (this.browser) {
      // Wait until hydration has finished: changing what a prerendered page shows
      // while Angular is still adopting its HTML leaves that page unresponsive.
      void inject(ApplicationRef)
        .whenStable()
        .then(() => {
          this.savedIds.update((now) => merge(now, this.read(SAVED_KEY)));
          this.compareIds.update((now) => merge(now, this.read(COMPARE_KEY)).slice(0, COMPARE_LIMIT));
          this.recentIds.update((now) => merge(now, this.read(RECENT_KEY)).slice(0, RECENT_LIMIT));
          this.loaded = true;
        });
    }
    effect(() => this.write(SAVED_KEY, this.savedIds()));
    effect(() => this.write(COMPARE_KEY, this.compareIds()));
    effect(() => this.write(RECENT_KEY, this.recentIds()));
  }

  isSaved(id: string): boolean {
    return this.savedIds().includes(id);
  }

  isCompared(id: string): boolean {
    return this.compareIds().includes(id);
  }

  toggleSaved(v: Pick<Vehicle, 'id' | 'make' | 'model'>): void {
    if (this.isSaved(v.id)) {
      this.savedIds.update((ids) => ids.filter((x) => x !== v.id));
      this.flash(`Removed ${v.make} ${v.model} from your saved cars`);
    } else {
      this.savedIds.update((ids) => [v.id, ...ids]);
      this.flash(`Saved ${v.make} ${v.model}`);
    }
  }

  toggleCompare(v: Pick<Vehicle, 'id' | 'make' | 'model'>): void {
    if (this.isCompared(v.id)) {
      this.compareIds.update((ids) => ids.filter((x) => x !== v.id));
      return;
    }
    if (this.compareIds().length >= COMPARE_LIMIT) {
      this.flash(`You can compare up to ${COMPARE_LIMIT} vehicles. Remove one first.`);
      return;
    }
    this.compareIds.update((ids) => [...ids, v.id]);
    this.flash(`Added ${v.make} ${v.model} to compare`);
  }

  clearCompare(): void {
    this.compareIds.set([]);
  }

  markViewed(id: string): void {
    this.recentIds.update((ids) => [id, ...ids.filter((x) => x !== id)].slice(0, RECENT_LIMIT));
  }

  dismissNotice(): void {
    this.notice.set(null);
  }

  private flash(message: string): void {
    this.notice.set(message);
    if (!this.browser) return;
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.notice.set(null), 2600);
  }

  /** Keeps order, drops vehicles that have since been sold (no longer in stock). */
  private resolve(ids: string[]): Vehicle[] {
    const out: Vehicle[] = [];
    for (const id of ids) {
      const v = this.vehicles.getVehicleById(id);
      if (v) out.push(v);
    }
    return out;
  }

  private read(key: string): string[] {
    if (!this.browser) return [];
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  private write(key: string, ids: string[]): void {
    // Never overwrite the stored list before it has been read.
    if (!this.browser || !this.loaded) return;
    try {
      localStorage.setItem(key, JSON.stringify(ids));
    } catch {
      // Private mode or storage full: the feature still works for this visit.
    }
  }
}

/** Items picked during this visit first, then the stored ones, without duplicates. */
function merge(now: string[], stored: string[]): string[] {
  return [...now, ...stored.filter((id) => !now.includes(id))];
}
