import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/** Live site only; previews and localhost are never counted. */
const COUNTED_HOSTS = ['drivelinecarsales.co.uk', 'www.drivelinecarsales.co.uk'];
/** Set on a browser where staff signed in to /hub, so their own browsing is not counted. */
export const STAFF_BROWSER_KEY = 'dl.staffBrowser';

/** Site sections counted in stats/{day}.pages (keep in step with firestore.rules limits). */
export const PAGE_KEYS: Record<string, string> = {
  home: 'Home',
  cars: 'Used cars',
  vans: 'Used vans',
  vehicle: 'Vehicle pages',
  finance: 'Finance',
  warranty: 'Warranty',
  sell: 'Sell your car',
  reviews: 'Reviews',
  contact: 'Contact',
  saved: 'Saved',
  compare: 'Compare',
  legal: 'Legal pages',
  other: 'Other',
};

export const SOURCE_LABELS: Record<string, string> = {
  direct: 'Direct / WhatsApp / apps',
  google: 'Google',
  bing: 'Bing',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X (Twitter)',
  autotrader: 'Auto Trader',
  fengate: 'Fengate Car Sales',
  snatech: 'SNA Tech',
  other: 'Other websites',
};

/** London calendar day, e.g. 2026-11-10 (the stats document id). */
export function londonDay(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function pageKey(path: string): { page: string; carId?: string } | null {
  const p = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (p.startsWith('/hub')) return null;
  if (p === '/') return { page: 'home' };
  const [, first, second] = p.split('/');
  if (first === 'vehicle' && second && /^[\w-]{1,40}$/.test(second)) return { page: 'vehicle', carId: second };
  if (first === 'sell-your-car') return { page: 'sell' };
  if (first in PAGE_KEYS) return { page: first };
  return { page: 'other' };
}

export function trafficSource(referrer: string, search: string, ownHost: string): string {
  const utm = new URLSearchParams(search).get('utm_source')?.toLowerCase() ?? '';
  let host = '';
  try {
    host = referrer ? new URL(referrer).hostname.toLowerCase() : '';
  } catch {
    host = '';
  }
  const hay = utm || host;
  if (!hay || host === ownHost) return utm ? 'other' : 'direct';
  if (/google\./.test(hay) || hay === 'google') return 'google';
  if (/bing\.|duckduckgo|yahoo/.test(hay)) return 'bing';
  if (/facebook|fb\.|messenger/.test(hay)) return 'facebook';
  if (/instagram/.test(hay)) return 'instagram';
  if (/tiktok/.test(hay)) return 'tiktok';
  if (/(^|\.)t\.co$|twitter|(^|\.)x\.com$/.test(hay)) return 'x';
  if (/whatsapp|wa\.me/.test(hay)) return 'direct';
  if (/autotrader/.test(hay)) return 'autotrader';
  if (/fengatecarsales/.test(hay)) return 'fengate';
  if (/snatech/.test(hay)) return 'snatech';
  return 'other';
}

function deviceType(): string {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024 && window.matchMedia?.('(pointer: coarse)').matches) return 'tablet';
  return 'desktop';
}

/**
 * Cookie-free visit counter: every page view adds 1 to that day's totals in
 * Firestore `stats/{YYYY-MM-DD}`. Nothing is stored on the visitor's device and no
 * visitor is identified; a "visit" is a fresh load of the site (not a unique person).
 * Uses one small REST call, so visitors never download the Firebase SDK.
 */
@Injectable({ providedIn: 'root' })
export class VisitStatsService {
  private readonly router = inject(Router);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private started = false;

  start(): void {
    if (!this.browser || this.started || !environment.firebase) return;
    this.started = true;
    if (!COUNTED_HOSTS.includes(window.location.hostname)) return;
    if (navigator.webdriver) return;
    try {
      if (localStorage.getItem(STAFF_BROWSER_KEY) === '1') return;
    } catch {
      // storage blocked: still count
    }

    let first = true;
    const count = (url: string) => {
      const key = pageKey(url);
      if (!key) return;
      const entry = first;
      first = false;
      const send = () => this.record(key, entry);
      // Never compete with the page itself.
      if ('requestIdleCallback' in window) window.requestIdleCallback(send, { timeout: 4000 });
      else setTimeout(send, 1500);
    };
    // The first navigation may already be done by the time this starts.
    if (this.router.navigated) count(this.router.url);
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => count((e as NavigationEnd).urlAfterRedirects));
  }

  private record(key: { page: string; carId?: string }, entry: boolean): void {
    const fb = environment.firebase!;
    const doc = `projects/${fb.projectId}/databases/(default)/documents/stats/${londonDay()}`;
    const inc = (fieldPath: string) => ({ fieldPath, increment: { integerValue: '1' } });
    const transforms = [inc('views'), inc(`pages.\`${key.page}\``)];
    if (key.carId) transforms.push(inc(`cars.\`${key.carId}\``));
    if (entry) {
      transforms.push(inc('visits'));
      transforms.push(inc(`sources.\`${trafficSource(document.referrer, window.location.search, window.location.hostname)}\``));
      transforms.push(inc(`devices.\`${deviceType()}\``));
    }
    void fetch(
      `https://firestore.googleapis.com/v1/projects/${fb.projectId}/databases/(default)/documents:commit?key=${fb.apiKey}`,
      {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ writes: [{ transform: { document: doc, fieldTransforms: transforms } }] }),
      },
    ).catch(() => undefined);
  }
}
