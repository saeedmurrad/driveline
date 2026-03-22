import {
  Component,
  inject,
  signal,
  computed,
  OnDestroy,
  PLATFORM_ID,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { VehicleService } from '../../services/vehicle.service';
import { Vehicle } from '../../models/vehicle.model';
import { PartExchangeFormComponent } from '../../components/shared/part-exchange-form/part-exchange-form';
import { Web3FormsEnquiryService } from '../../services/web3forms-enquiry.service';
import { submitEnquiryWithWeb3Fallback } from '../../utils/submit-enquiry';

@Component({
  selector: 'app-vehicle-detail',
  imports: [RouterLink, FormsModule, CommonModule, PartExchangeFormComponent],
  templateUrl: './vehicle-detail.html',
  styleUrl: './vehicle-detail.css',
})
export class VehicleDetailComponent implements OnDestroy {
  private route = inject(ActivatedRoute);
  private vehicleService = inject(VehicleService);
  private platformId = inject(PLATFORM_ID);
  private web3 = inject(Web3FormsEnquiryService);
  private destroyRef = inject(DestroyRef);

  vehicle = signal<Vehicle | undefined>(undefined);
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
  activeTab = signal<'overview' | 'features' | 'finance'>('overview');
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
      } else {
        this.vehicle.set(undefined);
      }
      this.startGalleryAutoplay();
    });
  }

  ngOnDestroy(): void {
    this.stopGalleryAutoplay();
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

  setTab(tab: 'overview' | 'features' | 'finance') {
    this.activeTab.set(tab);
  }

  submitEnquiry() {
    const v = this.vehicle();
    const e = this.enquiry;
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
    submitEnquiryWithWeb3Fallback(
      this.web3,
      this.platformId,
      {
        subject,
        message: body,
        replyEmail: e.email,
        fromName,
      },
      subject,
      body,
      {
        onSuccess: () => {
          this.enquirySent.set(true);
          this.enquiryError.set(null);
        },
        onError: (msg) => this.enquiryError.set(msg),
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

    const message = `Hello, I'm interested in the ${v.year} ${v.make} ${v.model} ${v.derivative}.`;
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
    if (!isPlatformBrowser(this.platformId)) return '';
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

  /** Website line on the print sheet footer (host + base path, e.g. saeedmurrad.github.io/driveline). */
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
    const text = `Check out this ${title} at DriveLine`;

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
}
