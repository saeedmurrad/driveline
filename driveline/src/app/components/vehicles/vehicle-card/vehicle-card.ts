import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Vehicle } from '../../../models/vehicle.model';
import {
  monthlyPaymentForVehicle,
  FINANCE_DISCLAIMER_SHORT,
} from '../../../utils/finance-display';
import { GarageService } from '../../../services/garage.service';
import { euroStandard, meetsUlezStandard, priceReduction } from '../../../utils/vehicle-insights';
import { PhotoPendingComponent } from '../../shared/photo-pending/photo-pending';
import { IMG_SIZES, webpSrcset } from '../../../utils/stock-image';

@Component({
  selector: 'app-vehicle-card',
  imports: [RouterLink, CommonModule, PhotoPendingComponent],
  templateUrl: './vehicle-card.html',
  styleUrl: './vehicle-card.css',
})
export class VehicleCardComponent implements OnChanges {
  @Input({ required: true }) vehicle!: Vehicle;

  readonly financeDisclaimerShort = FINANCE_DISCLAIMER_SHORT;
  readonly sizes = IMG_SIZES;
  readonly webp = webpSrcset;

  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  protected readonly garage = inject(GarageService);

  private static readonly SCRUB_MAX = 6;

  hasPhotos(): boolean {
    return (this.vehicle.images?.length ?? 0) > 0 && !!this.vehicle.thumbnailImage;
  }

  scrubCount(): number {
    return Math.min(VehicleCardComponent.SCRUB_MAX, this.vehicle.images?.length ?? 0);
  }

  scrubSlots(): number[] {
    return Array.from({ length: this.scrubCount() }, (_, i) => i);
  }

  /** Move across the photo to flick through the first few images (mouse only). */
  onScrub(ev: PointerEvent): void {
    if (ev.pointerType !== 'mouse') return;
    const n = this.scrubCount();
    if (n <= 1) return;
    const el = ev.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const i = Math.min(n - 1, Math.max(0, Math.floor(((ev.clientX - rect.left) / rect.width) * n)));
    if (i !== this.hoverImageIndex()) this.hoverImageIndex.set(i);
  }

  /** £ cut from the previous published price (0 when none). */
  reduction(): number {
    return priceReduction(this.vehicle);
  }

  sold(): boolean {
    return this.vehicle.status === 'sold';
  }

  reserved(): boolean {
    return this.vehicle.status === 'reserved';
  }

  ulez(): boolean {
    return meetsUlezStandard(this.vehicle);
  }

  euro(): number | undefined {
    return euroStandard(this.vehicle);
  }

  toggleSaved(ev: Event): void {
    ev.stopPropagation();
    this.garage.toggleSaved(this.vehicle);
  }

  toggleCompare(ev: Event): void {
    ev.stopPropagation();
    this.garage.toggleCompare(this.vehicle);
  }
  /** Index into `vehicle.images` while hovering (cycles like dealer listing previews) */
  hoverImageIndex = signal(0);
  private hoverTimer: ReturnType<typeof setInterval> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['vehicle']) {
      this.stopHoverSlideshow();
      this.hoverImageIndex.set(0);
    }
  }

  /** Image shown on the card (thumbnail by default; rotates on hover when multiple photos exist) */
  cardImageSrc(): string {
    const v = this.vehicle;
    const imgs = v.images ?? [];
    if (imgs.length === 0) return v.thumbnailImage;
    const i = this.hoverImageIndex();
    return imgs[Math.min(i, imgs.length - 1)] ?? v.thumbnailImage;
  }

  onCardEnter(): void {
    // Photos change with pointer position (onScrub), not on a timer.
  }

  onCardLeave(): void {
    this.stopHoverSlideshow();
    this.hoverImageIndex.set(0);
  }

  private stopHoverSlideshow(): void {
    if (this.hoverTimer) {
      clearInterval(this.hoverTimer);
      this.hoverTimer = null;
    }
  }

  /**
   * Card body navigates to detail; CTAs use data-vehicle-card-cta so taps work on mobile
   * (nested routerLink + button + anchor was invalid and swallowed tel / inner clicks).
   */
  onCardClick(ev: MouseEvent): void {
    const t = ev.target as HTMLElement | null;
    if (t?.closest('[data-vehicle-card-cta]')) return;
    void this.router.navigate(['/vehicle', this.vehicle.id]);
  }

  /** 60 mo, 0% deposit illustrative (matches site calculator). */
  monthlyFinanceQuote(): number | undefined {
    return monthlyPaymentForVehicle(this.vehicle);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  }

  formatMileage(mileage: number): string {
    return new Intl.NumberFormat('en-GB').format(mileage) + ' miles';
  }

  getFuelIcon(fuel: string): string {
    const icons: Record<string, string> = {
      Petrol: '⛽',
      Diesel: '🛢️',
      Hybrid: '🔋',
      Electric: '⚡',
      'Plug-in Hybrid': '🔌',
    };
    return icons[fuel] || '⛽';
  }
}
