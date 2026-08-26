import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { HeaderComponent } from './components/layout/header/header';
import { FooterComponent } from './components/layout/footer/footer';
import { CookieBannerComponent } from './components/layout/cookie-banner/cookie-banner';
import { TrustedPartnersComponent } from './components/layout/trusted-partners/trusted-partners';
import { SeoService } from './services/seo.service';

@Component({
  selector: 'app-root',
  imports: [
    NgClass,
    RouterOutlet,
    HeaderComponent,
    TrustedPartnersComponent,
    FooterComponent,
    CookieBannerComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly seo = inject(SeoService);
  showHomeMobileFab = signal(true);
  private scrollCleanup: (() => void) | null = null;
  private navSub: Subscription | null = null;
  readonly isHubRoute = signal(false);

  constructor() {
    this.updateHubRouteFlag();
  }

  ngOnInit(): void {
    this.seo.init();
    this.updateHubRouteFlag();
    this.navSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.updateHubRouteFlag());

    if (!isPlatformBrowser(this.platformId)) return;

    const updateFabVisibility = () => {
      const isMobile = window.matchMedia('(max-width: 1023px)').matches;
      if (!isMobile || !this.isHomeRoute() || this.isHubRoute()) {
        this.showHomeMobileFab.set(true);
        return;
      }
      const threshold = Math.min(560, Math.round(window.innerHeight * 0.72));
      this.showHomeMobileFab.set(window.scrollY > threshold);
    };

    updateFabVisibility();
    window.addEventListener('scroll', updateFabVisibility, { passive: true });
    window.addEventListener('resize', updateFabVisibility, { passive: true });
    this.scrollCleanup = () => {
      window.removeEventListener('scroll', updateFabVisibility);
      window.removeEventListener('resize', updateFabVisibility);
    };
  }

  ngOnDestroy(): void {
    this.scrollCleanup?.();
    this.scrollCleanup = null;
    this.navSub?.unsubscribe();
    this.navSub = null;
  }

  private updateHubRouteFlag(): void {
    const path = this.router.url.split('?')[0].split('#')[0];
    this.isHubRoute.set(path.startsWith('/hub'));
  }

  isHomeRoute(): boolean {
    const path = this.router.url.split('?')[0].split('#')[0];
    return path === '/' || path === '';
  }
}
