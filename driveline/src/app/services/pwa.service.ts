import { Injectable, PLATFORM_ID, afterNextRender, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationStart, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';

/** Chrome / Edge / Android event that lets a page offer its own "Install" button. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const HOUR = 60 * 60 * 1000;
const RELOADED_KEY = 'dlPwaReloaded';
const pathOf = (url: string) => url.split('?')[0].split('#')[0];

/**
 * The installable-app side of the site (PWA):
 *  - install: our own "Install app" button (Chrome, Edge, Android) or the Share-menu steps (iPhone, iPad)
 *  - offline: tells the page when there is no connection, so it can say so
 *  - updates: a tab that has been open since before a new version went live moves to the new
 *    version on its next page change, so nobody keeps looking at old stock or prices
 *
 * Pages are always fetched fresh from the network when there is a connection (see
 * ngsw-config.json, navigationRequestStrategy "freshness"); the saved copy is only the
 * fall-back for when there is none.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  /** Absent where the app runs without the service worker set up (unit tests). */
  private readonly updates = inject(SwUpdate, { optional: true });
  private readonly router = inject(Router);
  private installEvent: InstallPromptEvent | null = null;
  private lastUpdateCheck = Date.now();

  /** No connection right now. */
  readonly offline = signal(false);
  /** Opened from the home screen / as its own window (already installed). */
  readonly standalone = signal(false);
  /** The browser is ready to show its install prompt when asked. */
  readonly canPrompt = signal(false);
  /** iPhone / iPad: installing is done by hand from the Share menu, so we show the steps. */
  readonly ios = signal(false);
  /** A newer version of the site is downloaded and waiting for the next page change. */
  readonly updateReady = signal(false);

  constructor() {
    // After the first render, so the page the server sent and the page in the browser start identical.
    afterNextRender(() => this.start());
  }

  /** Shows the browser's install prompt. Resolves true when the visitor accepted. */
  async install(): Promise<boolean> {
    const event = this.installEvent;
    if (!event) return false;
    // A prompt event can be used once; the browser sends a new one if the visitor says no.
    this.installEvent = null;
    this.canPrompt.set(false);
    try {
      await event.prompt();
      return (await event.userChoice).outcome === 'accepted';
    } catch {
      return false;
    }
  }

  private start(): void {
    if (!this.browser) return;

    this.offline.set(navigator.onLine === false);
    addEventListener('offline', () => this.offline.set(true));
    addEventListener('online', () => {
      this.offline.set(false);
      this.checkForUpdate();
    });

    const standaloneQuery = matchMedia('(display-mode: standalone)');
    const readStandalone = () =>
      this.standalone.set(standaloneQuery.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    readStandalone();
    standaloneQuery.addEventListener?.('change', readStandalone);

    // iPadOS reports itself as a Mac, so touch support is the tell.
    const ua = navigator.userAgent;
    this.ios.set(/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1));

    // The browser's own pop-up bar is held back (it would sit on top of our bottom bars);
    // the install is offered from our own button instead. index.html keeps an offer that
    // arrived before the app started.
    const offer = (event: Event | undefined) => {
      if (!event) return;
      event.preventDefault();
      this.installEvent = event as InstallPromptEvent;
      this.canPrompt.set(true);
    };
    offer((window as Window & { __dlInstallEvent?: Event }).__dlInstallEvent);
    addEventListener('beforeinstallprompt', offer);
    addEventListener('appinstalled', () => {
      this.installEvent = null;
      this.canPrompt.set(false);
      this.standalone.set(true);
    });

    const updates = this.updates;
    if (!updates?.isEnabled) return;

    updates.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') void this.onVersionReady();
    });
    // The saved copy of the app is damaged or incomplete: start again from the network, once.
    updates.unrecoverable.subscribe(() => this.reloadOnce());

    // The browser only looks for a new version when a page is loaded. Tabs and the installed
    // app can stay open for days, so look again when one comes back into view.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - this.lastUpdateCheck > HOUR) this.checkForUpdate();
    });

    this.router.events.subscribe((event) => {
      if (!(event instanceof NavigationStart) || !this.updateReady()) return;
      const from = pathOf(this.router.url);
      const to = pathOf(event.url);
      // Same page (a filter or tab change), or the staff hub with work in progress: leave alone.
      if (from === to || from.startsWith('/hub') || to.startsWith('/hub')) return;
      // Load the next page in full, so it arrives as the new version.
      if (event.navigationTrigger === 'popstate') location.reload();
      else location.assign(event.url);
    });
  }

  private checkForUpdate(): void {
    if (!this.updates?.isEnabled) return;
    this.lastUpdateCheck = Date.now();
    this.updates.checkForUpdate().catch(() => {});
  }

  private async onVersionReady(): Promise<void> {
    if (await this.runningLatestBuild()) {
      // This page already came from the network as the new version; let the saved copy
      // serve it too (so its pages keep working if the connection drops).
      await this.updates?.activateUpdate().catch(() => {});
      return;
    }
    this.updateReady.set(true);
  }

  /**
   * True when every script and stylesheet this page was built from is part of the newest
   * version. Build file names carry a fingerprint (main-AB12CD34.js), so one look is enough.
   */
  private async runningLatestBuild(): Promise<boolean> {
    try {
      const res = await fetch(`ngsw.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return false;
      const table = ((await res.json()) as { hashTable?: Record<string, string> }).hashTable ?? {};
      const latest = new Set(Object.keys(table).map((url) => url.split('/').pop()));
      const mine = [...document.querySelectorAll('script[src], link[rel="stylesheet"][href], link[rel="modulepreload"][href]')]
        .map((el) => new URL(el.getAttribute('src') ?? el.getAttribute('href') ?? '', document.baseURI))
        .filter((url) => url.origin === location.origin && /-[A-Z0-9]{8}\.(?:js|css)$/.test(url.pathname))
        .map((url) => url.pathname.split('/').pop());
      return mine.length > 0 && mine.every((name) => latest.has(name));
    } catch {
      return false;
    }
  }

  private reloadOnce(): void {
    try {
      if (sessionStorage.getItem(RELOADED_KEY)) return;
      sessionStorage.setItem(RELOADED_KEY, '1');
    } catch {
      return;
    }
    location.reload();
  }
}
