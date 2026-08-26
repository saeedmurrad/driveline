import {
  Injectable,
  inject,
  signal,
  computed,
  PLATFORM_ID,
  effect,
} from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { PlatformApiService } from './platform-api.service';
import type { DealerRecord } from '../models/dealer.model';
import type { Review } from '../models/review.model';
import type { BusinessInfo } from '../models/contact.model';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { DRIVELINE_DEALER, DRIVELINE_REVIEWS } from '../data/driveline-dealer.data';

@Injectable({ providedIn: 'root' })
export class DealerContextService {
  private readonly api = inject(PlatformApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly dealer = signal<DealerRecord | null>(null);
  readonly reviews = signal<Review[]>([]);

  readonly businessInfo = computed<BusinessInfo | null>(() => {
    const d = this.dealer();
    return d?.business ?? null;
  });

  readonly salesEmail = computed(() => this.businessInfo()?.email ?? '');
  readonly dealerName = computed(() => this.dealer()?.name ?? 'Dealer');
  readonly pageFlags = computed(
    () =>
      this.dealer()?.pageFlags ?? {
        finance: true,
        warranty: true,
        sellYourCar: true,
        reviews: true,
      },
  );

  constructor() {
    if (environment.useStaticData) {
      this.dealer.set(DRIVELINE_DEALER);
      this.reviews.set(DRIVELINE_REVIEWS);
      this.loading.set(false);
    } else if (isPlatformBrowser(this.platformId)) {
      void this.load();
    } else {
      this.loading.set(false);
    }

    effect(() => {
      const d = this.dealer();
      if (!d || !isPlatformBrowser(this.platformId)) return;
      const root = this.document.documentElement;
      root.style.setProperty('--color-primary', d.colors.primary);
      root.style.setProperty('--color-accent', d.colors.accent);
      root.style.setProperty('--tenant-primary', d.colors.primary);
      root.style.setProperty('--tenant-accent', d.colors.accent);
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const profile = await firstValueFrom(this.api.fetchDealerProfile());
      this.dealer.set(profile.dealer);
      this.reviews.set(profile.reviews);
    } catch (e) {
      this.error.set(
        e instanceof Error ? e.message : 'Could not load dealer configuration',
      );
    } finally {
      this.loading.set(false);
    }
  }

  /** SEO-friendly location string */
  locationLabel(): string {
    const b = this.businessInfo();
    if (!b) return environment.defaultDealerSlug;
    const parts = [b.address.town, b.address.county].filter(Boolean);
    return parts.join(', ') || b.name;
  }
}
