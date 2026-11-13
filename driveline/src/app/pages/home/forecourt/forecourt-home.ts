import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { VehicleService } from '../../../services/vehicle.service';
import { DealerContextService } from '../../../services/dealer-context.service';
import { Vehicle } from '../../../models/vehicle.model';
import { webpSrcset, IMG_SIZES } from '../../../utils/stock-image';
import { ThumbPipe } from '../../../pipes/thumb.pipe';
import { FINANCE_DISCLAIMER_SHORT, FINANCE_ILLUSTRATIVE_PARAMS, monthlyPaymentForVehicle } from '../../../utils/finance-display';
import { FindMeACarComponent } from '../../../components/shared/find-me-a-car/find-me-a-car';
import { RevealOnScrollDirective } from '../../../directives/reveal-on-scroll.directive';
import { VehicleCheckBandComponent } from '../../../components/shared/vehicle-check-band/vehicle-check-band';
import { FilmRenderer } from '../prestige/film-renderer';
import { PrestigeMagneticDirective } from '../prestige/prestige-motion';

type Chip = { id: string; label: string; test: (v: Vehicle) => boolean };

/**
 * Home page for the Forecourt theme (bold dealer look: charcoal, signal red, extended
 * capitals). A pinned photo "film" with an outlined DRIVELINE wordmark and live stats,
 * a search bar over its edge, the showroom grid with a dark details panel for the car you
 * point at, then brands, finance, reviews, FAQ and a visit block.
 * Loaded only when Forecourt is active (@defer in home.html).
 */
@Component({
  selector: 'app-forecourt-home',
  imports: [RouterLink, FormsModule, ThumbPipe, FindMeACarComponent, RevealOnScrollDirective, PrestigeMagneticDirective, VehicleCheckBandComponent],
  templateUrl: './forecourt-home.html',
  styleUrl: './forecourt-home.css',
})
export class ForecourtHomeComponent {
  private readonly vehicles = inject(VehicleService);
  private readonly dealer = inject(DealerContextService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly counts = this.vehicles.inventoryCategoryCounts;
  readonly stock = this.vehicles.allStock;
  readonly business = this.dealer.businessInfo;
  readonly since = 2006;
  readonly financeNote = FINANCE_DISCLAIMER_SHORT;
  readonly apr = FINANCE_ILLUSTRATIVE_PARAMS.representativeApr;
  readonly sizes = IMG_SIZES.card;

  // ---------------- Film (4 scenes driven by scroll) ----------------
  readonly shots = [
    { src: 'hero/hero-04-1600.webp', mobile: 'hero/hero-04-960.webp' },
    { src: 'hero/hero-03-1600.webp', mobile: 'hero/hero-03-960.webp' },
    { src: 'hero/hero-07-1600.webp', mobile: 'hero/hero-07-960.webp' },
    { src: 'hero/hero-05-1600.webp', mobile: 'hero/hero-05-960.webp' },
  ];
  readonly scenes = ['Since 2006', 'Inspected', 'Finance', 'Delivered'];
  readonly scene = signal(0);
  readonly gl = signal(false);
  readonly shotUrls = this.shots.map((s) => (typeof innerWidth === 'number' && innerWidth < 768 ? s.mobile : s.src));
  private readonly film = viewChild<ElementRef<HTMLElement>>('film');
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly mark = viewChild<ElementRef<HTMLElement>>('mark');
  private readonly bar = viewChild<ElementRef<HTMLElement>>('bar');

  readonly lowestMonthly = computed(() => {
    const m = this.stock()
      .map((v) => monthlyPaymentForVehicle(v))
      .filter((x): x is number => x != null);
    return m.length ? Math.min(...m) : undefined;
  });

  // ---------------- Search bar ----------------
  readonly makes = computed(() => [...new Set(this.stock().map((v) => v.make))].sort());
  readonly bodies = computed(() => [...new Set(this.stock().map((v) => v.bodyType))].filter(Boolean).sort());
  readonly budgets = [5000, 8000, 10000, 15000, 20000, 25000];
  search = { kind: 'cars', make: '', bodyType: '', maxPrice: '' };

  runSearch(): void {
    const qp: Record<string, string> = {};
    if (this.search.make) qp['make'] = this.search.make;
    if (this.search.bodyType) qp['bodyType'] = this.search.bodyType;
    if (this.search.maxPrice) qp['maxPrice'] = this.search.maxPrice;
    this.router.navigate([this.search.kind === 'vans' ? '/vans' : '/cars'], { queryParams: qp });
  }

  // ---------------- Showroom grid + details panel ----------------
  /** One chip per body style in stock (largest first), plus All and Vans, each with its live count. */
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
    return this.stock()
      .filter(c.test)
      .filter((v) => v.images?.length && !v.photosPending)
      .sort((a, b) => b.price - a.price)
      .slice(0, 8);
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
      { k: 'Engine', v: v.engineSize ? `${v.engineSize.toFixed(1)}L` : '—' },
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

  // ---------------- Brands on the forecourt ----------------
  readonly brands = computed(() => {
    const groups = new Map<string, Vehicle[]>();
    for (const v of this.stock()) {
      if (!groups.has(v.make)) groups.set(v.make, []);
      groups.get(v.make)!.push(v);
    }
    return [...groups.entries()]
      .map(([name, list]) => {
        const withPhoto = [...list].sort((a, b) => b.price - a.price).find((v) => v.images?.length && !v.photosPending);
        return {
          name,
          count: list.length,
          from: Math.min(...list.map((v) => v.price)),
          image: withPhoto?.thumbnailImage || withPhoto?.images?.[0] || null,
        };
      })
      .filter((b) => b.image)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 5);
  });

  // ---------------- Feature photo: the dearest car in stock ----------------
  readonly featureCar = computed(() =>
    [...this.stock()].filter((v) => v.images?.length && !v.photosPending && v.category !== 'van').sort((a, b) => b.price - a.price)[0] ?? null,
  );

  // ---------------- Reviews, FAQ, visit ----------------
  readonly reviews = computed(() => this.dealer.reviews().slice(0, 3));
  readonly rating = computed(() => {
    const r = this.dealer.reviews();
    if (!r.length) return null;
    return { avg: (r.reduce((s, x) => s + x.rating, 0) / r.length).toFixed(1), count: r.length };
  });
  initials(name: string): string {
    return name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  }
  reviewDate(d: string): string {
    const t = Date.parse(d);
    return Number.isNaN(t) ? d : new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

  // ---------------- Section rail (left edge, desktop) ----------------
  readonly sections = ['Top', 'Showroom', 'About', 'How it works', 'Sell', 'Brands', 'Finance', 'Reviews', 'Visit'];
  readonly activeSection = signal(0);
  private readonly sectionEls = viewChildren<ElementRef<HTMLElement>>('sec');

  goTo(i: number): void {
    const el = this.sectionEls()[i]?.nativeElement;
    el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  constructor() {
    afterNextRender(() => {
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const filmEl = this.film()?.nativeElement;
      const canvasEl = this.canvas()?.nativeElement;
      let renderer: FilmRenderer | null = null;
      if (filmEl && canvasEl && !reduce) {
        renderer = FilmRenderer.create(canvasEl, this.shotUrls, () => this.gl.set(true));
        renderer?.resize();
      }
      let frame = 0;
      const update = () => {
        frame = 0;
        if (filmEl) {
          const r = filmEl.getBoundingClientRect();
          const p = Math.max(0, Math.min(1, -r.top / Math.max(filmEl.offsetHeight - innerHeight, 1)));
          renderer?.draw(p);
          this.scene.set(Math.min(3, Math.floor(p * 4)));
          const m = this.mark()?.nativeElement;
          if (m) m.style.transform = `translate3d(${(-p * 14).toFixed(2)}vw,0,0)`;
          const br = this.bar()?.nativeElement;
          if (br) br.style.transform = `scaleX(${p.toFixed(4)})`;
          document.documentElement.classList.toggle('forecourt-over-film', r.bottom > 72);
        }
        // Which section sits in the middle of the screen
        const els = this.sectionEls();
        let active = 0;
        for (let i = 0; i < els.length; i++) if (els[i].nativeElement.getBoundingClientRect().top < innerHeight * 0.5) active = i;
        this.activeSection.set(active);
      };
      const onScroll = () => {
        if (!frame) frame = requestAnimationFrame(update);
      };
      const onResize = () => {
        renderer?.resize();
        onScroll();
      };
      addEventListener('scroll', onScroll, { passive: true });
      addEventListener('resize', onResize, { passive: true });
      update();
      this.destroyRef.onDestroy(() => {
        removeEventListener('scroll', onScroll);
        removeEventListener('resize', onResize);
        if (frame) cancelAnimationFrame(frame);
        renderer?.destroy();
        document.documentElement.classList.remove('forecourt-over-film');
      });
    });
  }

  formatPrice(n: number): string {
    return '£' + n.toLocaleString('en-GB');
  }
}
