import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { VisitStatsService } from './services/visit-stats.service';
import { filter, Subscription } from 'rxjs';
import { HeaderComponent } from './components/layout/header/header';
import { FooterComponent } from './components/layout/footer/footer';
import { CookieBannerComponent } from './components/layout/cookie-banner/cookie-banner';
import { TrustedPartnersComponent } from './components/layout/trusted-partners/trusted-partners';
import { CompareTrayComponent } from './components/shared/compare-tray/compare-tray';
import { VehicleCheckBandComponent } from './components/shared/vehicle-check-band/vehicle-check-band';
import { SeoService } from './services/seo.service';
import { DealerContextService } from './services/dealer-context.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    HeaderComponent,
    TrustedPartnersComponent,
    FooterComponent,
    CookieBannerComponent,
    CompareTrayComponent,
    VehicleCheckBandComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly dealerContext = inject(DealerContextService);

  readonly phoneTel = computed(() => {
    const phone = this.dealerContext.businessInfo()?.phone?.replace(/\D/g, '');
    return phone ? `tel:${phone}` : '';
  });

  private navSub: Subscription | null = null;
  readonly isHubRoute = signal(false);
  /** Free vehicle check band: every page except the home page (shown higher up there) and the check page itself. */
  readonly showCheckBand = signal(false);
  private readonly visitStats = inject(VisitStatsService);

  constructor() {
    this.updateHubRouteFlag();
  }

  ngOnInit(): void {
    this.seo.init();
    this.visitStats.start();
    this.updateHubRouteFlag();
    this.navSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.updateHubRouteFlag());
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
    this.navSub = null;
  }

  private updateHubRouteFlag(): void {
    const path = this.router.url.split('?')[0].split('#')[0];
    this.isHubRoute.set(path.startsWith('/hub'));
    this.showCheckBand.set(!path.startsWith('/hub') && path !== '/' && path !== '' && !path.startsWith('/mot-check'));
  }
}
