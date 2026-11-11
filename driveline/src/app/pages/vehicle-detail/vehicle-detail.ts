import { ThumbPipe } from '../../pipes/thumb.pipe';
import {
  effect,
  ElementRef,
  viewChild,
  Component,
  DOCUMENT,
  inject,
  signal,
  computed,
  OnDestroy,
  PLATFORM_ID,
  DestroyRef,
  HostListener,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { MotHistoryComponent } from '../../components/vehicles/mot-history/mot-history';
import { DvlaVehicleService } from '../../services/dvla-vehicle.service';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser, ViewportScroller } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { VehicleService } from '../../services/vehicle.service';
import { Vehicle } from '../../models/vehicle.model';
import { PartExchangeFormComponent } from '../../components/shared/part-exchange-form/part-exchange-form';
import { VehicleCardComponent } from '../../components/vehicles/vehicle-card/vehicle-card';
import { VisitRequestComponent, type VisitRequestKind } from '../../components/shared/visit-request/visit-request';
import { FinanceCalculatorComponent } from '../../components/shared/ownership-tools/finance-calculator';
import { RunningCostsComponent } from '../../components/shared/ownership-tools/running-costs';
import { DeliveryCheckComponent } from '../../components/shared/ownership-tools/delivery-check';
import { VehicleGalleryComponent } from '../../components/vehicles/vehicle-gallery/vehicle-gallery';
import { PhotoPendingComponent } from '../../components/shared/photo-pending/photo-pending';
import { GarageService } from '../../services/garage.service';
import { GOV_MOT_CHECK, TFL_VEHICLE_CHECKER, euroStandard, meetsUlezStandard, similarVehicles, priceReduction, youtubeId } from '../../utils/vehicle-insights';
import { EnquirySubmitService } from '../../services/enquiry-submit.service';
import { DealerContextService } from '../../services/dealer-context.service';
import { validateEnquiryFields } from '../../utils/enquiry-validation';
import { scrollFormAlertIntoView } from '../../utils/scroll-form-alert';
import {
  monthlyPaymentForVehicle,
  financeTermOptionsForPrice,
  FINANCE_ILLUSTRATIVE_PARAMS,
  FINANCE_DISCLAIMER_SHORT,
  FINANCE_DISCLAIMER_DETAIL,
} from '../../utils/finance-display';

@Component({
  selector: 'app-vehicle-detail',
  imports: [ThumbPipe, 
    RouterLink,
    FormsModule,
    CommonModule,
    PartExchangeFormComponent,
    VehicleCardComponent,
    VisitRequestComponent,
    FinanceCalculatorComponent,
    RunningCostsComponent,
    DeliveryCheckComponent,
    VehicleGalleryComponent,
    PhotoPendingComponent,
    MotHistoryComponent,
  ],
  templateUrl: './vehicle-detail.html',
  styleUrl: './vehicle-detail.css',
  // Prerendered for search engines and link previews; the browser re-renders it on load
  // (the gallery, print sheet and garage state differ between server and browser).
  host: { ngSkipHydration: 'true' },
})
export class VehicleDetailComponent implements OnDestroy {
  private route = inject(ActivatedRoute);
  private vehicleService = inject(VehicleService);
  private platformId = inject(PLATFORM_ID);
  private enquirySubmit = inject(EnquirySubmitService);
  private dealerContext = inject(DealerContextService);
  private destroyRef = inject(DestroyRef);
  private viewportScroller = inject(ViewportScroller);
  private title = inject(Title);
  private readonly sanitizer = inject(DomSanitizer);
  private meta = inject(Meta);
  private document = inject(DOCUMENT);
  protected readonly garage = inject(GarageService);

  readonly tflChecker = TFL_VEHICLE_CHECKER;
  readonly motCheck = GOV_MOT_CHECK;
  readonly visitKind = signal<VisitRequestKind | null>(null);
  readonly visitTitles: Record<VisitRequestKind, string> = {
    'test-drive': 'Book a test drive',
    reserve: 'Reserve this vehicle',
    video: 'Live video viewing',
  };

  readonly ulez = computed(() => {
    const v = this.vehicle();
    return v ? meetsUlezStandard(v) : false;
  });
  readonly sold = computed(() => this.vehicle()?.status === 'sold');

  /** At-a-glance facts with icons (Heroicons-style paths). */
  readonly keyFacts = computed(() => {
    const v = this.vehicle();
    if (!v) return [];
    const facts = [
      { label: 'Year', value: String(v.year), icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { label: 'Mileage', value: `${this.formatMileage(v.mileage)} mi`, icon: 'M12 12l3-3m-3 3a2 2 0 100 0zM4.9 19a9 9 0 1114.2 0' },
      { label: 'Fuel', value: v.fuelType, icon: 'M3 21V6a2 2 0 012-2h6a2 2 0 012 2v15M3 21h10M7 8h2m6-2l3 3v8a2 2 0 01-4 0v-3h-1' },
      { label: 'Gearbox', value: v.transmission, icon: 'M6 4v16m6-16v16m6-16v8H6' },
      { label: 'Engine', value: v.engineSize ? `${v.engineSize.toFixed(1)}L` : '—', icon: 'M4 9h2V7h4V5h4v2h2l2 2h2v6h-2l-2 2H8l-2-2H4V9z' },
      { label: 'Body', value: v.bodyType, icon: 'M3 13l2-5a2 2 0 011.9-1.4h10.2A2 2 0 0119 8l2 5v5h-2a2 2 0 01-4 0H9a2 2 0 01-4 0H3v-5zm0 0h18' },
    ];
    if (v.previousOwners > 0) facts.push({ label: 'Owners', value: String(v.previousOwners), icon: 'M17 20h5v-2a3 3 0 00-5.4-1.8M9 20H2v-2a3 3 0 015.4-1.8M15 7a3 3 0 11-6 0 3 3 0 016 0z' });
    return facts.filter((f) => f.value && f.value !== '—');
  });

  /** YouTube walkaround (loaded only when the visitor presses play). */
  readonly videoId = computed(() => youtubeId(this.vehicle()?.videoUrl));
  readonly videoPlaying = signal(false);
  videoEmbedUrl(id: string) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`);
  }

  /** Desktop summary bar: shown once the price card has scrolled out of view. */
  readonly showSummaryBar = signal(false);
  private summaryObserver: IntersectionObserver | null = null;
  private readonly priceCard = viewChild<ElementRef<HTMLElement>>('priceCard');
  private readonly watchPriceCard = effect(() => {
    const el = this.priceCard()?.nativeElement;
    this.summaryObserver?.disconnect();
    if (!el || !isPlatformBrowser(this.platformId) || typeof IntersectionObserver === 'undefined') return;
    this.summaryObserver = new IntersectionObserver(
      ([entry]) => this.showSummaryBar.set(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    this.summaryObserver.observe(el);
  });
  readonly reserved = computed(() => this.vehicle()?.status === 'reserved');
  readonly reduction = computed(() => {
    const v = this.vehicle();
    return v ? priceReduction(v) : 0;
  });
  /** " on 12 November" for sold cars (empty when unknown). */
  readonly soldAgo = computed(() => {
    const at = this.vehicle()?.soldAt;
    if (!at) return '';
    return ' on ' + new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  });
  readonly euro = computed(() => {
    const v = this.vehicle();
    return v ? euroStandard(v) : undefined;
  });
  readonly similar = computed(() => {
    const v = this.vehicle();
    return v ? similarVehicles(v, this.vehicleService.allStock()) : [];
  });
  readonly recent = computed(() => {
    const id = this.vehicle()?.id;
    return this.garage.recentVehicles().filter((v) => v.id !== id).slice(0, 6);
  });

  vehicle = signal<Vehicle | undefined>(undefined);
  dealerName = this.dealerContext.dealerName;
  businessInfo = this.dealerContext.businessInfo;
  selectedImageIndex = signal(0);
  /** Pauses autoplay while user hovers the main image */
  galleryHoverPaused = signal(false);
  private galleryAutoplayId: ReturnType<typeof setInterval> | null = null;
  private touchStartX = 0;

  /** Safe main image URL (avoids broken index when switching vehicles) */
  mainGallerySrc = computed(() => {
    const v = this.vehicle();
    if (!v) return '';
    const imgs = v.images ?? [];
    if (!imgs.length) return v.thumbnailImage ?? '';
    let i = this.selectedImageIndex();
    if (i < 0 || i >= imgs.length) i = 0;
    return imgs[i];
  });

  /** Lowest illustrative monthly (60 mo, 0% deposit) — matches listing cards. */
  monthlyFinanceQuote = computed(() => {
    const v = this.vehicle();
    if (!v) return undefined;
    return monthlyPaymentForVehicle(v);
  });

  /** Rows for Finance tab calculator: 36 / 48 / 60 months. */
  financeTermRows = computed(() => {
    const v = this.vehicle();
    if (!v) return [];
    return financeTermOptionsForPrice(v.price);
  });

  readonly financeParams = FINANCE_ILLUSTRATIVE_PARAMS;
  readonly financeDisclaimerShort = FINANCE_DISCLAIMER_SHORT;
  readonly financeDisclaimerDetail = FINANCE_DISCLAIMER_DETAIL;

  activeTab = signal<'overview' | 'features' | 'finance' | 'costs' | 'mot'>('overview');
  /** MOT history tab only when the vehicle check service is set up and we know the reg. */
  private readonly motAvailable = inject(DvlaVehicleService).isAvailable();
  readonly tabs = computed(() => [
    { key: 'overview', label: 'Overview' },
    { key: 'features', label: 'Features & Equipment' },
    { key: 'finance', label: 'Finance' },
    { key: 'costs', label: 'Running costs' },
    ...(this.motAvailable && this.vehicle()?.registration ? [{ key: 'mot', label: 'MOT history' }] : []),
  ]);
  enquirySent = signal(false);
  enquirySubmitting = signal(false);
  enquiryError = signal<string | null>(null);
  partExchangeOpen = signal(false);
  shareFeedback = signal<'idle' | 'copied' | 'shared'>('idle');

  enquiry = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    message: '',
    newsletterOptIn: false,
  };

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      this.stopGalleryAutoplay();
      this.selectedImageIndex.set(0);
      this.galleryHoverPaused.set(false);
      if (id) {
        const v = this.vehicleService.getVehicleById(id);
        this.vehicle.set(v);
        this.updateVehicleSeo(v);
        if (v) this.garage.markViewed(v.id);
        this.visitKind.set(null);
      } else {
        this.vehicle.set(undefined);
        this.clearVehicleSchema();
      }
      // Same component can be reused when switching vehicles — ensure we’re at the top
      if (isPlatformBrowser(this.platformId)) {
        requestAnimationFrame(() => this.viewportScroller.scrollToPosition([0, 0]));
      }
    });
  }

  openVisit(kind: VisitRequestKind): void {
    this.visitKind.set(kind);
  }

  closeVisit(): void {
    this.visitKind.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visitKind()) this.closeVisit();
  }

  ngOnDestroy(): void {
    this.summaryObserver?.disconnect();
    if (isPlatformBrowser(this.platformId)) this.document.body.style.overflow = '';
    this.stopGalleryAutoplay();
    this.clearVehicleSchema();
  }

  private updateVehicleSeo(v: Vehicle | undefined): void {
    if (!v) return;
    const canonical = this.getCanonicalVehicleListingUrl();
    const dealerName = this.dealerContext.dealerName();
    const loc = this.dealerContext.locationLabel();
    const title = `${v.year} ${v.make} ${v.model} ${v.derivative} | ${dealerName}`;
    const description = `${v.year} ${v.make} ${v.model} ${v.derivative}. ${this.formatMileage(v.mileage)} miles, ${v.fuelType}, ${v.transmission}. ${this.formatPrice(v.price)} at ${dealerName} ${loc}.`;

    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    // Branded share card (scripts/generate-share-images.mjs) for cars with photos.
    const shareImage = this.toAbsoluteUrl(
      v.images?.length && !v.photosPending ? `og/${v.id}.jpg` : 'og-image.jpg',
    );
    this.meta.updateTag({ property: 'og:image', content: shareImage });
    this.meta.updateTag({ property: 'og:image:width', content: '1200' });
    this.meta.updateTag({ property: 'og:image:height', content: '630' });
    this.meta.updateTag({ property: 'og:image:alt', content: `${v.year} ${v.make} ${v.model} at ${dealerName}` });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: shareImage });
    this.upsertCanonical(canonical);
    this.upsertVehicleSchema(v, canonical);
  }

  private toAbsoluteUrl(url: string): string {
    if (!url) return '';
    try {
      if (!isPlatformBrowser(this.platformId)) {
        const base = this.getDeployedAppBaseUrl();
        return base ? new URL(url, `${base}/`).toString() : url;
      }
      return new URL(url, window.location.origin).toString();
    } catch {
      return url;
    }
  }

  private upsertCanonical(url: string): void {
    const head = this.document.head;
    let canonical = head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.rel = 'canonical';
      head.appendChild(canonical);
    }
    canonical.href = url;
  }

  private upsertVehicleSchema(v: Vehicle, canonical: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const head = this.document.head;
    const id = 'vehicle-schema-jsonld';
    let script = this.document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = this.document.createElement('script');
      script.type = 'application/ld+json';
      script.id = id;
      head.appendChild(script);
    }

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Vehicle',
      name: `${v.year} ${v.make} ${v.model} ${v.derivative}`.trim(),
      brand: { '@type': 'Brand', name: v.make },
      model: `${v.model} ${v.derivative}`.trim(),
      bodyType: v.bodyType,
      vehicleTransmission: v.transmission,
      fuelType: v.fuelType,
      vehicleModelDate: String(v.year),
      color: v.colour,
      numberOfDoors: v.doors,
      mileageFromOdometer: {
        '@type': 'QuantitativeValue',
        value: v.mileage,
        unitCode: 'SMI',
      },
      image: (v.images || [])
        .slice(0, 8)
        .map((img) => this.toAbsoluteUrl(img))
        .filter(Boolean),
      url: canonical,
      offers: {
        '@type': 'Offer',
        priceCurrency: 'GBP',
        price: v.price,
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/UsedCondition',
        url: canonical,
        seller: {
          '@type': 'AutoDealer',
          name: this.dealerContext.dealerName(),
          url: this.getDeployedAppBaseUrl() || canonical,
        },
      },
    };
    script.textContent = JSON.stringify(schema);
  }

  private clearVehicleSchema(): void {
    const existing = this.document.getElementById('vehicle-schema-jsonld');
    if (existing?.parentNode) existing.parentNode.removeChild(existing);
  }

  private startGalleryAutoplay(): void {
    this.stopGalleryAutoplay();
    if (!isPlatformBrowser(this.platformId)) return;
    const v = this.vehicle();
    if (!v || v.images.length <= 1) return;
    this.galleryAutoplayId = setInterval(() => {
      if (this.galleryHoverPaused()) return;
      this.nextImage();
    }, 5000);
  }

  private stopGalleryAutoplay(): void {
    if (this.galleryAutoplayId != null) {
      clearInterval(this.galleryAutoplayId);
      this.galleryAutoplayId = null;
    }
  }

  onGalleryTouchStart(e: TouchEvent): void {
    this.touchStartX = e.changedTouches[0]?.clientX ?? 0;
  }

  onGalleryTouchEnd(e: TouchEvent): void {
    const x = e.changedTouches[0]?.clientX ?? 0;
    const dx = x - this.touchStartX;
    if (dx > 50) this.prevImage();
    else if (dx < -50) this.nextImage();
  }

  selectImage(index: number) {
    const v = this.vehicle();
    if (!v?.images?.length) return;
    const i = Math.max(0, Math.min(index, v.images.length - 1));
    this.selectedImageIndex.set(i);
  }

  nextImage() {
    const v = this.vehicle();
    if (!v?.images?.length) return;
    this.selectedImageIndex.update((i) => (i + 1) % v.images.length);
  }

  prevImage() {
    const v = this.vehicle();
    if (!v?.images?.length) return;
    this.selectedImageIndex.update((i) =>
      i === 0 ? v.images.length - 1 : i - 1
    );
  }

  setTab(tab: 'overview' | 'features' | 'finance' | 'costs' | 'mot') {
    this.activeTab.set(tab);
  }

  submitEnquiry() {
    const v = this.vehicle();
    const e = this.enquiry;
    const validationError = validateEnquiryFields(e);
    if (validationError) {
      this.enquiryError.set(validationError);
      scrollFormAlertIntoView(this.platformId, 'vehicle-enquiry-alert');
      return;
    }
    const vehicleLine = v
      ? `${v.year} ${v.make} ${v.model} ${v.derivative} · Stock ref ${v.id} · ${this.formatPrice(v.price)}`
      : 'Vehicle details unavailable';
    const body = [
      `Enquiry about: ${vehicleLine}`,
      '',
      `Name: ${e.firstName} ${e.lastName}`,
      `Email: ${e.email}`,
      `Phone: ${e.phone}`,
      `Newsletter opt-in: ${e.newsletterOptIn ? 'Yes' : 'No'}`,
      '',
      'Message:',
      e.message || '—',
    ].join('\n');
    const subject = v
      ? `Vehicle enquiry — ${v.year} ${v.make} ${v.model}`
      : 'Vehicle enquiry';
    const fromName =
      `${e.firstName} ${e.lastName}`.trim() || 'Website visitor';
    void this.enquirySubmit.submit(
      {
        type: 'vehicle',
        subject,
        payload: { ...e, body, vehicleLine },
        vehicleId: v?.id,
        mailtoSubject: subject,
        mailtoBody: body,
      },
      {
        onSuccess: () => {
          this.enquirySent.set(true);
          this.enquiryError.set(null);
        },
        onError: (msg) => {
          this.enquiryError.set(msg);
          scrollFormAlertIntoView(this.platformId, 'vehicle-enquiry-alert');
        },
        setSubmitting: (val) => this.enquirySubmitting.set(val),
      },
    );
  }

  /** Cars vs vans listing route for breadcrumb */
  listingsParentPath(): string {
    return this.vehicle()?.category === 'van' ? '/vans' : '/cars';
  }

  formatMm(value: number | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    return `${value.toLocaleString('en-GB')} mm`;
  }

  formatBootL(value: number | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    return `${value.toLocaleString('en-GB')} L`;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  }

  formatRoadTax(value: number | undefined): string {
    if (value == null) return '—';
    return this.formatPrice(value);
  }

  formatMileage(mileage: number): string {
    return new Intl.NumberFormat('en-GB').format(mileage);
  }

  getWhatsAppUrl(): string {
    const v = this.vehicle();
    if (!v) return 'https://wa.me/447423374244';

    const message = `Hello, I'm interested in the ${v.year} ${v.make} ${v.model} ${v.derivative} (${this.formatPrice(v.price)}, stock ref ${v.id}). Is it still available?`;
    return `https://wa.me/447423374244?text=${encodeURIComponent(message)}`;
  }

  printVehicleDetails(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.print();
    }
  }

  /**
   * Deployed app root (origin + Angular `base href`), no trailing slash.
   * Works on GitHub Pages (`/driveline/`), localhost, and production domains.
   */
  private getDeployedAppBaseUrl(): string {
    if (!isPlatformBrowser(this.platformId)) {
      // Prerendering: use the dealer's public domain so canonical and share links are absolute.
      const domain = this.dealerContext.dealer()?.customDomains?.[0];
      return domain ? `https://${domain}` : '';
    }
    const raw = document.querySelector('base')?.getAttribute('href')?.trim() || '/';
    const resolved = new URL(raw, `${window.location.origin}/`);
    let out = resolved.href.replace(/\/$/, '');
    if (!out) out = window.location.origin;
    return out;
  }

  /** Full URL to this vehicle listing where the app is actually hosted (print / QR). */
  getCanonicalVehicleListingUrl(): string {
    const v = this.vehicle();
    if (!v) return '';
    const base = this.getDeployedAppBaseUrl();
    if (!base) return '';
    return `${base}/vehicle/${encodeURIComponent(v.id)}`;
  }

  /** QR image encoding the current deployment listing URL for this vehicle only. */
  getQrCodeImageUrl(): string {
    const url = this.getCanonicalVehicleListingUrl();
    if (!url) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(url)}`;
  }

  getPrintWebsiteDisplay(): string {
    const base = this.getDeployedAppBaseUrl();
    if (!base) return '';
    try {
      const u = new URL(`${base}/`);
      const path = u.pathname.replace(/\/$/, '');
      return path ? `${u.host}${path}` : u.host;
    } catch {
      return '';
    }
  }

  getPrintMainImage(): string {
    return this.vehicle()?.images[0] ?? '';
  }

  getPrintSecondaryImage(): string {
    const imgs = this.vehicle()?.images ?? [];
    if (imgs.length > 1) return imgs[1];
    return imgs[0] ?? '';
  }

  getPrintSpecItems(): { label: string; value: string }[] {
    const v = this.vehicle();
    if (!v) return [];
    const cc = Math.round(v.engineSize * 1000);
    return [
      { label: 'Engine', value: `${cc}cc` },
      { label: 'Body', value: v.bodyType },
      { label: 'Gearbox', value: v.transmission },
      { label: 'Fuel Type', value: v.fuelType },
      { label: 'Mileage', value: this.formatMileage(v.mileage) },
      {
        label: 'Top Speed',
        value: v.topSpeedMph != null ? `${v.topSpeedMph}MPH` : '—',
      },
      { label: 'Power', value: v.bhp != null ? `${v.bhp}BHP` : '—' },
      {
        label: 'Consumption',
        value: v.mpg != null ? `${v.mpg.toFixed(1)}MPG` : '—',
      },
    ];
  }

  /**
   * Split features into three columns for the print sheet (capped for one A4 page).
   */
  getPrintFeatureColumns(): string[][] {
    const items = (this.vehicle()?.features ?? []).slice(0, 15);
    if (items.length === 0) return [[], [], []];
    const per = Math.ceil(items.length / 3);
    return [
      items.slice(0, per),
      items.slice(per, per * 2),
      items.slice(per * 2),
    ];
  }

  hasMorePrintFeatures(): boolean {
    return (this.vehicle()?.features.length ?? 0) > 15;
  }

  async shareVehicle(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const v = this.vehicle();
    if (!v) return;

    const url = window.location.href;
    const title = `${v.year} ${v.make} ${v.model}`;
    const text = `Check out this ${title} at ${this.dealerContext.dealerName()}`;

    this.shareFeedback.set('idle');

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        this.shareFeedback.set('shared');
        setTimeout(() => this.shareFeedback.set('idle'), 2500);
      } catch (err: unknown) {
        const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : '';
        if (name === 'AbortError') return;
        await this.copyUrlToClipboard(url);
      }
    } else {
      await this.copyUrlToClipboard(url);
    }
  }

  private async copyUrlToClipboard(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      this.shareFeedback.set('copied');
      setTimeout(() => this.shareFeedback.set('idle'), 2500);
    } catch {
      this.shareFeedback.set('idle');
    }
  }

  openPartExchange(): void {
    this.partExchangeOpen.set(true);
  }

  closePartExchange(): void {
    this.partExchangeOpen.set(false);
  }

  onPartExchangeDismiss(): void {
    this.closePartExchange();
  }

  getPrintAddress(): string {
    const b = this.businessInfo();
    if (!b) return '';
    return [
      b.address.line1,
      b.address.line2,
      b.address.town,
      b.address.county,
      b.address.postcode,
    ]
      .filter(Boolean)
      .join(', ');
  }

  getPrintPhoneLines(): string[] {
    const b = this.businessInfo();
    if (!b) return [];
    return [b.phone, b.mobile].filter(Boolean);
  }
}
