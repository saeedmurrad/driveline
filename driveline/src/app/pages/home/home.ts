import { isPlatformBrowser, NgClass } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { VehicleService } from '../../services/vehicle.service';
import { VehicleCardComponent } from '../../components/vehicles/vehicle-card/vehicle-card';
import { SearchWidgetComponent } from '../../components/search/search-widget/search-widget';
import { TestimonialCardComponent } from '../../components/shared/testimonial-card/testimonial-card';
import { RevealOnScrollDirective } from '../../directives/reveal-on-scroll.directive';
import { computed } from '@angular/core';
import { DealerContextService } from '../../services/dealer-context.service';
import { FindMeACarComponent } from '../../components/shared/find-me-a-car/find-me-a-car';
import { GarageService } from '../../services/garage.service';
import { meetsUlezStandard } from '../../utils/vehicle-insights';
import { makeSlug } from '../../utils/make-slug';
import { FINANCE_DISCLAIMER_SHORT } from '../../utils/finance-display';
import { ThemeService } from '../../services/theme.service';
import { PrestigeHomeComponent } from './prestige/prestige-home';
import { ForecourtHomeComponent } from './forecourt/forecourt-home';
import { VehicleCheckBandComponent } from '../../components/shared/vehicle-check-band/vehicle-check-band';

@Component({
  selector: 'app-home',
  imports: [
    NgClass,
    RouterLink,
    VehicleCardComponent,
    SearchWidgetComponent,
    TestimonialCardComponent,
    RevealOnScrollDirective,
    FindMeACarComponent,
    PrestigeHomeComponent,
    ForecourtHomeComponent,
    VehicleCheckBandComponent,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomeComponent {
  private vehicleService = inject(VehicleService);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);

  private dealerContext = inject(DealerContextService);
  protected readonly themeService = inject(ThemeService);

  featuredVehicles = this.vehicleService.featuredVehicles;
  readonly reducedVehicles = this.vehicleService.reducedVehicles;
  readonly recentlySold = this.vehicleService.recentlySold;
  readonly stockCounts = this.vehicleService.inventoryCategoryCounts;
  protected readonly garage = inject(GarageService);
  readonly financeNote = FINANCE_DISCLAIMER_SHORT;

  /** Quick ways in: by body type (with live counts) and by budget. */
  readonly bodyTypes = computed(() => {
    const counts = new Map<string, number>();
    for (const v of this.vehicleService.allStock()) {
      if (v.category === 'van') continue;
      counts.set(v.bodyType, (counts.get(v.bodyType) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  });

  readonly budgets = computed(() => {
    const stock = this.vehicleService.allStock().filter((v) => v.category !== 'van');
    const bands = [
      { label: 'Under £5,000', max: 5000 },
      { label: 'Under £8,000', max: 8000 },
      { label: 'Under £12,000', max: 12000 },
      { label: 'Under £20,000', max: 20000 },
    ];
    return bands
      .map((b) => ({ ...b, count: stock.filter((v) => v.price <= b.max).length }))
      .filter((b) => b.count > 0);
  });

  /** Makes in stock (most first) for the "By make" links. */
  readonly makes = computed(() => {
    const counts = new Map<string, number>();
    for (const v of this.vehicleService.allStock()) counts.set(v.make, (counts.get(v.make) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count, slug: makeSlug(name) }));
  });

  readonly ulezCount = computed(
    () => this.vehicleService.allStock().filter((v) => meetsUlezStandard(v)).length,
  );
  readonly automaticCount = computed(
    () => this.vehicleService.allStock().filter((v) => v.transmission === 'Automatic').length,
  );
  reviews = computed(() => this.dealerContext.reviews().slice(0, 3));
  business = this.dealerContext.businessInfo;
  dealerName = this.dealerContext.dealerName;

  /**
   * Hero backgrounds sourced from user-provided image URLs and stored in `public/hero/*`.
   */
  readonly heroSlides: readonly { src: string; alt: string }[] = [
    { src: 'hero/hero-01.jpeg', alt: '' },
    { src: 'hero/hero-02.jpeg', alt: '' },
    { src: 'hero/hero-03.jpeg', alt: '' },
    { src: 'hero/hero-04.jpeg', alt: '' },
    { src: 'hero/hero-05.jpeg', alt: '' },
    { src: 'hero/hero-06.jpeg', alt: '' },
    { src: 'hero/hero-07.jpeg', alt: '' },
    { src: 'hero/hero-08.jpeg', alt: '' },
  ];

  heroActiveIndex = signal(0);
  private heroRotateTimer: number | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.heroRotateTimer !== undefined) clearInterval(this.heroRotateTimer);
    });
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      this.heroRotateTimer = window.setInterval(() => {
        this.heroActiveIndex.update((i) => (i + 1) % this.heroSlides.length);
      }, 8000);
    });
  }

  /** Slide on show, the next one (preloading) and the previous one (still fading out). */
  heroNear(idx: number): boolean {
    const n = this.heroSlides.length;
    const a = this.heroActiveIndex();
    return idx === a || idx === (a + 1) % n || idx === (a - 1 + n) % n;
  }

  heroSrcset(src: string): string {
    const base = src.replace(/\.jpe?g$/i, '');
    return `${base}-960.webp 960w, ${base}-1600.webp 1402w`;
  }

  setHeroSlide(index: number): void {
    const n = this.heroSlides.length;
    if (n === 0) return;
    this.heroActiveIndex.set(((index % n) + n) % n);
  }

  stats = [
    { value: '500+', label: 'Cars Sold', icon: 'car' },
    { value: '18+', label: 'Years Experience', icon: 'clock' },
    { value: '5★', label: 'Average Rating', icon: 'star' },
    { value: '100%', label: 'Warranty Cover', icon: 'shield' },
  ];
}
