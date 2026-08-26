import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
  computed,
} from '@angular/core';
import { NgClass, isPlatformBrowser } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { HeaderComponent } from './components/layout/header/header';
import { FooterComponent } from './components/layout/footer/footer';
import { CookieBannerComponent } from './components/layout/cookie-banner/cookie-banner';
import { TrustedPartnersComponent } from './components/layout/trusted-partners/trusted-partners';
import { SeoService } from './services/seo.service';
import { DealerContextService } from './services/dealer-context.service';

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
  private readonly dealerContext = inject(DealerContextService);

  readonly phoneTel = computed(() => {
    const phone = this.dealerContext.businessInfo()?.phone?.replace(/\D/g, '');
    return phone ? `tel:${phone}` : '';
  });

  readonly whatsappUrl = computed(() => {
    const mobile = this.dealerContext.businessInfo()?.mobile?.replace(/\D/g, '');
    if (!mobile) return '';
    const intl = mobile.startsWith('0') ? `44${mobile.slice(1)}` : mobile;
    return `https://wa.me/${intl}`;
  });

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
