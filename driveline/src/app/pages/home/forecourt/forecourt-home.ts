import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { VehicleService } from '../../../services/vehicle.service';
import { DealerContextService } from '../../../services/dealer-context.service';
import { Vehicle } from '../../../models/vehicle.model';
import { webpAt, webpSrcset, IMG_SIZES } from '../../../utils/stock-image';
import { ThumbPipe } from '../../../pipes/thumb.pipe';
import {
  FINANCE_DISCLAIMER_SHORT,
  FINANCE_ILLUSTRATIVE_PARAMS,
  monthlyPaymentForVehicle,
} from '../../../utils/finance-display';
import { FindMeACarComponent } from '../../../components/shared/find-me-a-car/find-me-a-car';
import { VehicleCheckBandComponent } from '../../../components/shared/vehicle-check-band/vehicle-check-band';

type Chip = { id: string; label: string; test: (v: Vehicle) => boolean };

const SLIDE_MS = 6500;

/**
 * Home page for the Forecourt theme: a motorsport-style dealer page, built to look and move
 * nothing like Prestige. A car showcase slider with red wipe transitions and slow photo zoom,
 * kinetic headline, a moving make ticker, live search count, counters that count up, the
 * showroom with a details panel, a timeline that draws itself, finance tabs and a scrolling
 * strip of reviews. Loaded only when Forecourt is active (@defer in home.html).
 */
@Component({
  selector: 'app-forecourt-home',
  imports: [RouterLink, FormsModule, ThumbPipe, FindMeACarComponent, VehicleCheckBandComponent],
  templateUrl: './forecourt-home.html',
  styleUrl: './forecourt-home.css',
})
export class ForecourtHomeComponent {
  private readonly vehicles = inject(VehicleService);
  private readonly dealer = inject(DealerContextService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;

  readonly counts = this.vehicles.inventoryCategoryCounts;
  readonly stock = this.vehicles.allStock;
  readonly business = this.dealer.businessInfo;
  readonly since = 2006;
  readonly financeNote = FINANCE_DISCLAIMER_SHORT;
  readonly apr = FINANCE_ILLUSTRATIVE_PARAMS.representativeApr;
  readonly sizes = IMG_SIZES.card;
  private readonly reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  private readonly withPhotos = computed(() => this.stock().filter((v) => v.images?.length && !v.photosPending));

  // ---------------- Hero showcase slider ----------------
  /** The five dearest cars with photos, shown one after another. */
  readonly showcase = computed(() => [...this.withPhotos()].filter((v) => v.category !== 'van').sort((a, b) => b.price - a.price).slice(0, 5));
  readonly slide = signal(0);
  /** Bumped on every change so the progress bar animation restarts. */
  readonly slideRun = signal(0);
  readonly paused = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  slideImage(v: Vehicle): string {
    const src = v.images[0];
    return webpAt(src, 1600) ?? src;
  }
  monthly(v: Vehicle): number | null {
    return monthlyPaymentForVehicle(v) ?? null;
  }
  go(i: number): void {
    const n = this.showcase().length;
    if (!n) return;
    this.slide.set((i + n) % n);
    this.slideRun.update((x) => x + 1);
    this.schedule();
  }
  pause(on: boolean): void {
    this.paused.set(on);
    if (on) this.clearTimer();
    else this.schedule();
  }
  private schedule(): void {
    this.clearTimer();
    if (this.reduce || this.paused() || typeof window === 'undefined') return;
    this.timer = setTimeout(() => this.go(this.slide() + 1), SLIDE_MS);
  }
  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  // ---------------- Ticker ----------------
  readonly ticker = computed(() => {
    const makes = [...new Set(this.stock().map((v) => v.make))].sort();
    return ['Inspected', ...makes.slice(0, 4), 'Warranted', ...makes.slice(4, 8), 'Finance for all', ...makes.slice(8, 12), 'UK delivery'];
  });

  // ---------------- Counters (count up when they come into view) ----------------
  readonly makesCount = computed(() => new Set(this.stock().map((v) => v.make)).size);
  readonly countersOn = signal(false);
  readonly counterValues = signal<number[]>([0, 0, 0, 0]);

  // ---------------- Search with live result count ----------------
  readonly makes = computed(() => [...new Set(this.stock().map((v) => v.make))].sort());
  readonly bodies = computed(() => [...new Set(this.stock().map((v) => v.bodyType))].filter(Boolean).sort());
  readonly budgets = [5000, 8000, 10000, 15000, 20000, 25000];
  readonly kind = signal<'cars' | 'vans'>('cars');
  readonly make = signal('');
  readonly body = signal('');
  readonly maxPrice = signal('');
  readonly matches = computed(() =>
    this.stock().filter(
      (v) =>
        (this.kind() === 'vans' ? v.category === 'van' : v.category !== 'van') &&
        (!this.make() || v.make === this.make()) &&
        (!this.body() || v.bodyType === this.body()) &&
        (!this.maxPrice() || v.price <= +this.maxPrice()),
    ).length,
  );

  runSearch(): void {
    const qp: Record<string, string> = {};
    if (this.make()) qp['make'] = this.make();
    if (this.body()) qp['bodyType'] = this.body();
    if (this.maxPrice()) qp['maxPrice'] = this.maxPrice();
    this.router.navigate([this.kind() === 'vans' ? '/vans' : '/cars'], { queryParams: qp });
  }

  // ---------------- Showroom grid + details panel ----------------
  readonly chips = computed<Chip[]>(() => {
    const cars = this.stock().filter((v) => v.category !== 'van');
    const byBody = new Map<string, number>();
    for (const v of cars) if (v.bodyType) byBody.set(v.bodyType, (byBody.get(v.bodyType) ?? 0) + 1);
    const bodies = [...byBody.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([b]) => b);
    return [
      { id: 'all', label: 'All', test: (v: Vehicle) => v.category !== 'van' },
      ...bodies.map((b) => ({ id: b, label: b, test: (v: Vehicle) => v.category !== 'van' && v.bodyType === b })),
      { id: 'vans', label: 'Vans', test: (v: Vehicle) => v.category === 'van' },
    ];
  });
  readonly chip = signal('all');
  readonly chipCounts = computed(() => {
    const s = this.stock();
    return Object.fromEntries(this.chips().map((c) => [c.id, s.filter(c.test).length]));
  });
  readonly grid = computed(() => {
    const c = this.chips().find((x) => x.id === this.chip()) ?? this.chips()[0];
    return this.withPhotos()
      .filter(c.test)
      .sort((a, b) => b.price - a.price)
      .slice(0, 6);
  });
  readonly selectedId = signal<string | null>(null);
  readonly selected = computed<Vehicle | null>(() => {
    const g = this.grid();
    return g.find((v) => v.id === this.selectedId()) ?? g[0] ?? null;
  });
  readonly selectedSpecs = computed(() => {
    const v = this.selected();
    if (!v) return [];
    return [
      { k: 'Mileage', v: v.mileage.toLocaleString('en-GB') },
      { k: 'Fuel', v: v.fuelType },
      { k: 'Gearbox', v: v.transmission },
      { k: 'Colour', v: v.colour },
      { k: 'Engine', v: v.engineSize ? `${v.engineSize.toFixed(1)}L` : '' },
      { k: 'Body', v: v.bodyType },
    ].filter((s) => s.v);
  });
  readonly selectedMonthly = computed(() => {
    const v = this.selected();
    return v ? monthlyPaymentForVehicle(v) : null;
  });
  setChip(id: string): void {
    this.chip.set(id);
    this.selectedId.set(null);
  }
  srcset(v: Vehicle): string | null {
    return webpSrcset(v.thumbnailImage || v.images?.[0]);
  }

  // ---------------- Timeline (draws itself while you scroll through it) ----------------
  readonly steps = [
    { t: 'Choose', d: 'Browse online or walk the forecourt on Fengate, seven days a week.' },
    { t: 'Check', d: 'Test drive it, or ask for a live video walkaround. Full history and MOT shown.' },
    { t: 'Reserve', d: 'Call or message to hold it. We sort finance and part exchange.' },
    { t: 'Drive away', d: 'Collect it from the forecourt, or we deliver anywhere in the UK.' },
  ];
  readonly lineProgress = signal(0);
  private readonly timeline = viewChild<ElementRef<HTMLElement>>('timeline');

  // ---------------- Brands strip ----------------
  readonly brands = computed(() => {
    const groups = new Map<string, Vehicle[]>();
    for (const v of this.stock()) {
      if (!groups.has(v.make)) groups.set(v.make, []);
      groups.get(v.make)!.push(v);
    }
    return [...groups.entries()]
      .map(([name, list]) => {
        const withPhoto = [...list].sort((a, b) => b.price - a.price).find((v) => v.images?.length && !v.photosPending);
        return { name, count: list.length, from: Math.min(...list.map((v) => v.price)), image: withPhoto?.thumbnailImage || withPhoto?.images?.[0] || null };
      })
      .filter((b) => b.image)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 10);
  });

  // ---------------- Finance tabs ----------------
  readonly financeTabs = [
    { id: 'hp', t: 'Hire purchase', k: 'Own it', d: 'Pay a deposit, then the balance in fixed monthly instalments plus interest. After the final payment the car is yours outright.', points: ['Fixed monthly payments', 'You own it at the end', '36 to 60 months'] },
    { id: 'pcp', t: 'PCP', k: 'Flexible', d: 'A deposit and lower monthly payments. At the end, pay the final balance to keep it, hand it back, or put any equity towards your next car.', points: ['Lower monthly payments', 'Three choices at the end', 'Mileage agreed up front'] },
    { id: 'ch', t: 'Contract hire', k: 'Lease', d: 'Much like PCP, but without the option to buy the car outright at the end. Hand it back and choose your next one.', points: ['Simple monthly rental', 'No balloon payment', 'Swap at the end'] },
  ];
  readonly finTab = signal(0);

  // ---------------- Reviews strip, FAQ, visit ----------------
  readonly reviews = computed(() => this.dealer.reviews().slice(0, 6));
  readonly rating = computed(() => {
    const r = this.dealer.reviews();
    if (!r.length) return null;
    return { avg: (r.reduce((s, x) => s + x.rating, 0) / r.length).toFixed(1), count: r.length };
  });
  initials(name: string): string {
    return name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  }
  readonly faqs = [
    { q: 'When are you open?', a: 'Seven days a week: Monday to Saturday 09:00 to 18:00 and Sunday 10:00 to 16:00. We are open on bank holidays, and other times are available by appointment.' },
    { q: 'Can I view a car after dark?', a: 'Yes. The showroom is fully lit, so evening viewings by appointment are no problem.' },
    { q: 'Do you deliver?', a: 'Yes, we deliver throughout the UK. You can also ask for a live video walkaround before you decide.' },
    { q: 'Can you help if I’ve been refused finance before?', a: 'We are FCA registered and work with lenders for all credit histories. Ask us and we will see what we can do.' },
    { q: 'Do you take part exchanges?', a: 'Yes. Send us the details and a few photos and we will give you a fair figure, against your next car or as a straight sale.' },
  ];
  readonly openFaq = signal(0);
  mapsUrl(): string {
    const b = this.business();
    const q = b ? `${b.address.line1}, ${b.address.line2}, ${b.address.town} ${b.address.postcode}` : 'DriveLine Car Sales Peterborough';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }
  tel(n: string | undefined): string {
    return 'tel:' + (n ?? '').replace(/\s+/g, '');
  }

  constructor() {
    afterNextRender(() => {
      this.schedule();

      // Sections slide up into view once (skipped when the visitor prefers less motion)
      const reveal = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            e.target.classList.add('in');
            reveal.unobserve(e.target);
          }
        },
        { rootMargin: '0px 0px -10% 0px' },
      );
      for (const el of this.host.querySelectorAll('[data-reveal]')) {
        if (this.reduce) el.classList.add('in');
        else reveal.observe(el);
      }

      // Counters count up the first time they are seen
      const targets = () => [this.counts().car + this.counts().van, this.makesCount(), new Date().getFullYear() - this.since, 7];
      const counterEl = this.host.querySelector('.fc-counters');
      const counterObs = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        counterObs.disconnect();
        this.countersOn.set(true);
        const end = targets();
        if (this.reduce) return this.counterValues.set(end);
        const t0 = performance.now();
        const tick = (now: number) => {
          const k = Math.min(1, (now - t0) / 1400);
          const ease = 1 - Math.pow(1 - k, 3);
          this.counterValues.set(end.map((n) => Math.round(n * ease)));
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      if (counterEl) counterObs.observe(counterEl);

      // Timeline line follows the scroll
      let frame = 0;
      const update = () => {
        frame = 0;
        const el = this.timeline()?.nativeElement;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const p = (innerHeight * 0.75 - r.top) / (r.height + innerHeight * 0.25);
        this.lineProgress.set(this.reduce ? 1 : Math.max(0, Math.min(1, p)));
      };
      const onScroll = () => {
        if (!frame) frame = requestAnimationFrame(update);
      };
      addEventListener('scroll', onScroll, { passive: true });
      update();

      this.destroyRef.onDestroy(() => {
        this.clearTimer();
        reveal.disconnect();
        counterObs.disconnect();
        removeEventListener('scroll', onScroll);
        if (frame) cancelAnimationFrame(frame);
      });
    });
  }

  formatPrice(n: number): string {
    return '£' + n.toLocaleString('en-GB');
  }
}
