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

@Component({
  selector: 'app-vehicle-card',
  imports: [RouterLink, CommonModule],
  templateUrl: './vehicle-card.html',
  styleUrl: './vehicle-card.css',
})
export class VehicleCardComponent implements OnChanges {
  @Input({ required: true }) vehicle!: Vehicle;

  readonly financeDisclaimerShort = FINANCE_DISCLAIMER_SHORT;

  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
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
    if (!isPlatformBrowser(this.platformId)) return;
    const imgs = this.vehicle.images ?? [];
    if (imgs.length <= 1) return;
    this.stopHoverSlideshow();
    this.hoverTimer = setInterval(() => {
      this.hoverImageIndex.update((n) => (n + 1) % imgs.length);
    }, 2400);
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
