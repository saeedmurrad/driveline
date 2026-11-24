import { Injectable, PLATFORM_ID, afterNextRender, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
import { firebaseAuth, useEmulators } from './firebase-client';

/** A stock search someone asked to be told about ("new Audi estates under £10,000"). */
export interface SavedSearch {
  category?: string;
  make?: string;
  bodyType?: string;
  fuelType?: string;
  transmission?: string;
  maxPrice?: number;
  maxMonthly?: number;
}

/**
 * ready         the browser can show notifications
 * needs-install iPhone / iPad: notifications only work once the site is on the home screen
 * blocked       the visitor has blocked notifications for this site
 * unavailable   this browser or build cannot do it (the buttons stay hidden)
 */
export type AlertsStatus = 'ready' | 'needs-install' | 'blocked' | 'unavailable';

const STORE_KEY = 'dl.alerts';
const STAFF_KEY = 'dl.staffAlerts';
const PUSH_API_OVERRIDE = 'dl.pushApi';
const MAX_VEHICLES = 40;
const MAX_SEARCHES = 5;

const env = environment as typeof environment & { pushApiUrl?: string; vapidPublicKey?: string };

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const sameSearch = (a: SavedSearch, b: SavedSearch) => JSON.stringify(normalise(a)) === JSON.stringify(normalise(b));
function normalise(s: SavedSearch): SavedSearch {
  const out: Record<string, string | number> = {};
  for (const k of ['category', 'make', 'bodyType', 'fuelType', 'transmission'] as const) {
    const v = s[k]?.trim();
    if (v) out[k] = v;
  }
  for (const k of ['maxPrice', 'maxMonthly'] as const) {
    const n = Number(s[k]);
    if (Number.isFinite(n) && n > 0) out[k] = Math.round(n);
  }
  return out as SavedSearch;
}

/**
 * Notifications for visitors (price drops on cars they follow, new arrivals matching a
 * saved search) and for staff (a new website enquiry). Sent by the Cloudflare worker in
 * workers/dvla-ves-proxy/push.js; this service only looks after the browser side.
 *
 * Nothing personal is stored: the worker keeps the browser's anonymous notification
 * address plus the car ids / search filters to match against.
 */
@Injectable({ providedIn: 'root' })
export class AlertsService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly status = signal<AlertsStatus>('unavailable');
  readonly vehicleIds = signal<string[]>([]);
  readonly searches = signal<SavedSearch[]>([]);
  /** This device gets staff enquiry alerts. */
  readonly staffOn = signal(false);
  readonly busy = signal(false);
  /** Short message after an action ("Alerts are on", "Could not turn alerts on"…). */
  readonly notice = signal<string | null>(null);
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  /** Show the alert buttons at all (also true on an iPhone that still needs the app installed). */
  readonly offered = computed(() => this.status() !== 'unavailable');

  constructor() {
    // After the first render, so the prerendered page and the browser start identical.
    afterNextRender(() => this.start());
  }

  private start(): void {
    this.status.set(this.detect());
    if (this.status() === 'unavailable') return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') as { vehicleIds?: string[]; searches?: SavedSearch[] };
      this.vehicleIds.set(Array.isArray(saved.vehicleIds) ? saved.vehicleIds.map(String).slice(0, MAX_VEHICLES) : []);
      this.searches.set(Array.isArray(saved.searches) ? saved.searches.map(normalise).slice(0, MAX_SEARCHES) : []);
      this.staffOn.set(localStorage.getItem(STAFF_KEY) === '1');
    } catch {
      // storage blocked: alerts still work for this visit
    }
  }

  private apiUrl(): string {
    if (!this.browser) return '';
    const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (local) {
      // Local testing: point at a local worker (wrangler dev) and never at the live one from test runs.
      try {
        const override = localStorage.getItem(PUSH_API_OVERRIDE);
        if (override) return override.replace(/\/+$/, '');
      } catch {
        // ignore
      }
      if (useEmulators()) return '';
    }
    return (env.pushApiUrl || '').replace(/\/+$/, '');
  }

  private detect(): AlertsStatus {
    if (!this.browser || !env.vapidPublicKey || !this.apiUrl() || !('serviceWorker' in navigator)) return 'unavailable';
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (!('PushManager' in window) || !('Notification' in window)) return ios ? 'needs-install' : 'unavailable';
    return Notification.permission === 'denied' ? 'blocked' : 'ready';
  }

  watchesVehicle(id: string): boolean {
    return this.vehicleIds().includes(String(id));
  }

  watchesSearch(search: SavedSearch): boolean {
    return this.searches().some((s) => sameSearch(s, search));
  }

  /** Follow / stop following one car's price. */
  async toggleVehicle(id: string): Promise<void> {
    const key = String(id);
    const on = !this.watchesVehicle(key);
    const next = on ? [key, ...this.vehicleIds()].slice(0, MAX_VEHICLES) : this.vehicleIds().filter((v) => v !== key);
    await this.apply(next, this.searches(), on ? 'We will tell you if this price drops' : 'Price alert turned off');
  }

  /** Follow / stop following new arrivals for a search. */
  async toggleSearch(search: SavedSearch): Promise<void> {
    const clean = normalise(search);
    const on = !this.watchesSearch(clean);
    if (on && this.searches().length >= MAX_SEARCHES) {
      this.say(`You can follow ${MAX_SEARCHES} searches. Turn one off first.`);
      return;
    }
    const next = on ? [clean, ...this.searches()] : this.searches().filter((s) => !sameSearch(s, clean));
    await this.apply(this.vehicleIds(), next, on ? 'We will tell you when a matching car arrives' : 'New-arrival alert turned off');
  }

  private async apply(vehicleIds: string[], searches: SavedSearch[], done: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const wasEmpty = this.vehicleIds().length + this.searches().length === 0;
      const turningOn = vehicleIds.length + searches.length > 0;
      const subscription = await this.subscription(turningOn);
      if (!subscription) {
        if (turningOn) {
          this.say(this.status() === 'blocked' ? 'Notifications are blocked for this site in your browser settings.' : 'Could not turn alerts on. Please try again.');
          return;
        }
      } else {
        await this.post('/push/subscribe', { subscription, vehicleIds, searches, confirm: wasEmpty && turningOn });
      }
      this.vehicleIds.set(vehicleIds);
      this.searches.set(searches);
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ vehicleIds, searches }));
      } catch {
        // storage blocked
      }
      this.say(done);
    } catch {
      this.say('Could not update your alerts. Check your connection and try again.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Staff: this device is told about new enquiries (hub must be signed in). */
  async setStaff(on: boolean): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const subscription = await this.subscription(on);
      if (!subscription) {
        if (on) this.say(this.status() === 'blocked' ? 'Notifications are blocked for this site in your browser settings.' : 'Could not turn alerts on. Please try again.');
        if (on) return;
      } else {
        const auth = await firebaseAuth();
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error('signed out');
        await this.post('/push/staff', { subscription, idToken, on });
      }
      this.staffOn.set(on);
      try {
        localStorage.setItem(STAFF_KEY, on ? '1' : '0');
      } catch {
        // storage blocked
      }
      this.say(on ? 'Enquiry alerts are on for this device' : 'Enquiry alerts are off for this device');
    } catch {
      this.say('Could not change enquiry alerts. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Called after an enquiry is saved: asks the worker to notify staff. Never blocks or fails the form. */
  pingStaff(type: string): void {
    const base = this.apiUrl();
    if (!base) return;
    try {
      void fetch(base + '/push/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      // never let an alert problem affect the enquiry
    }
  }

  /** The browser's notification address; asks permission when `create` is true. */
  private async subscription(create: boolean): Promise<PushSubscriptionJSON | null> {
    if (this.status() === 'unavailable' || this.status() === 'needs-install') return null;
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 40_000)),
    ]);
    if (!registration) return null;
    let sub = await registration.pushManager.getSubscription();
    if (!sub && create) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.status.set(permission === 'denied' ? 'blocked' : 'ready');
        return null;
      }
      sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(env.vapidPublicKey!) });
    }
    return sub ? sub.toJSON() : null;
  }

  private async post(path: string, body: unknown): Promise<void> {
    const r = await fetch(this.apiUrl() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`alerts ${r.status}`);
  }

  private say(message: string): void {
    this.notice.set(message);
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.notice.set(null), 5000);
  }
}
