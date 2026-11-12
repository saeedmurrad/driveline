import { Injectable, PLATFORM_ID, afterNextRender, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

/**
 * Site themes. "default" is the original DriveLine look; "prestige" is the cream, charcoal
 * and gold editorial look. A theme is just html[data-theme] — all colours and fonts read
 * CSS variables (see tailwind.config.js and src/styles.css), so switching is instant.
 *
 * The choice is stored in localStorage ('dlTheme') and applied by the inline script in
 * index.html before the first paint, so there is no flash of the other theme.
 */
export type SiteTheme = 'default' | 'prestige';

export const SITE_THEMES: { id: SiteTheme; label: string; hint: string; swatch: string[] }[] = [
  { id: 'default', label: 'Default', hint: 'Classic DriveLine rose', swatch: ['#f43f5e', '#fb923c', '#fffbf7'] },
  { id: 'prestige', label: 'Prestige', hint: 'Cream, charcoal and gold', swatch: ['#b8925a', '#16161a', '#f6f3ee'] },
];

/** Extra fonts for Prestige, only downloaded when that theme is used. Keep in sync with index.html. */
export const PRESTIGE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,500..800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';

const STORAGE_KEY = 'dlTheme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Starts as 'default' everywhere so the browser's first render matches the prerendered HTML
   * (Angular hydration). Right after that first render the stored theme is applied; pages with
   * a Prestige-only layout show a dark placeholder until then (CSS keyed on html[data-theme]).
   */
  readonly theme = signal<SiteTheme>('default');

  constructor() {
    if (this.browser) afterNextRender(() => this.theme.set(this.readInitial()));
  }

  /** Logo mark that matches the theme */
  logoMark(): string {
    return this.theme() === 'prestige' ? 'brand/driveline-mark-prestige.svg' : 'brand/driveline-mark.svg';
  }

  set(theme: SiteTheme): void {
    this.theme.set(theme);
    if (!this.browser) return;
    const root = this.document.documentElement;
    if (theme === 'default') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    if (theme === 'prestige') this.loadPrestigeFonts();
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* private mode: the choice just isn't remembered */
    }
  }

  private readInitial(): SiteTheme {
    if (!this.browser) return 'default';
    // index.html already applied the stored theme before Angular started
    return this.document.documentElement.getAttribute('data-theme') === 'prestige' ? 'prestige' : 'default';
  }

  private loadPrestigeFonts(): void {
    if (this.document.getElementById('dl-prestige-fonts')) return;
    const link = this.document.createElement('link');
    link.id = 'dl-prestige-fonts';
    link.rel = 'stylesheet';
    link.href = PRESTIGE_FONTS_HREF;
    this.document.head.appendChild(link);
  }
}
