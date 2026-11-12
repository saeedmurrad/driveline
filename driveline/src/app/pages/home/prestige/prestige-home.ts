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
import { meetsUlezStandard, priceReduction } from '../../../utils/vehicle-insights';
import { webpSrcset, IMG_SIZES } from '../../../utils/stock-image';
import { ThumbPipe } from '../../../pipes/thumb.pipe';
import {
  FINANCE_DISCLAIMER_SHORT,
  FINANCE_ILLUSTRATIVE_PARAMS,
  financeTermOptionsForPrice,
  monthlyPaymentForVehicle,
} from '../../../utils/finance-display';
import { FindMeACarComponent } from '../../../components/shared/find-me-a-car/find-me-a-car';
import { RevealOnScrollDirective } from '../../../directives/reveal-on-scroll.directive';
import { FilmRenderer } from './film-renderer';
import { PrestigeTiltDirective, PrestigeMagneticDirective } from './prestige-motion';

type Chip = { id: string; label: string; test: (v: Vehicle) => boolean };

/**
 * Home page for the Prestige theme: a scroll-driven hero "film", a filterable stock grid with
 * a sticky finance panel, and editorial sections. Loaded only when Prestige is active
 * (@defer in home.html), so Default visitors never download it.
 */
@Component({
  selector: 'app-prestige-home',
  imports: [RouterLink, FormsModule, ThumbPipe, FindMeACarComponent, RevealOnScrollDirective, PrestigeTiltDirective, PrestigeMagneticDirective],
  templateUrl: './prestige-home.html',
  styleUrl: './prestige-home.css',
})
export class PrestigeHomeComponent {
  private readonly vehicles = inject(VehicleService);
  private readonly dealer = inject(DealerContextService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly counts = this.vehicles.inventoryCategoryCounts;
  readonly stock = this.vehicles.allStock;
  readonly business = this.dealer.businessInfo;
  readonly yearsTrading = new Date().getFullYear() - 2006;
  readonly financeNote = FINANCE_DISCLAIMER_SHORT;
  readonly apr = FINANCE_ILLUSTRATIVE_PARAMS.representativeApr;
  readonly sizes = IMG_SIZES.card;

  // ---------------- Film ----------------
  readonly shots = [
    { src: 'hero/hero-01-1600.webp', mobile: 'hero/hero-01-960.webp' },
    { src: 'hero/hero-05-1600.webp', mobile: 'hero/hero-05-960.webp' },
    { src: 'hero/hero-06-1600.webp', mobile: 'hero/hero-06-960.webp' },
    { src: 'hero/hero-08-1600.webp', mobile: 'hero/hero-08-960.webp' },
  ];
  readonly chapters = ['Stock', 'Finance', 'Part exchange', 'Delivery'];
  /** Chapter on show (0-3). Per-frame values (progress bar, name drift) are written straight to the DOM. */
  readonly chapter = signal(0);
  /** True once WebGL has drawn its first photo; until then (and without WebGL) the <img> stack shows. */
  readonly gl = signal(false);
  readonly shotUrls = this.shots.map((s) => (typeof innerWidth === 'number' && innerWidth < 768 ? s.mobile : s.src));
  private readonly film = viewChild<ElementRef<HTMLElement>>('film');
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly ghost = viewChild<ElementRef<HTMLElement>>('ghost');
  private readonly rail = viewChild<ElementRef<HTMLElement>>('rail');
  private readonly bar = viewChild<ElementRef<HTMLElement>>('bar');

  readonly lowestMonthly = computed(() => {
    const m = this.stock()
      .map((v) => monthlyPaymentForVehicle(v))
      .filter((x): x is number => x != null);
    return m.length ? Math.min(...m) : undefined;
  });

  readonly rating = computed(() => {
    const r = this.dealer.reviews();
    if (!r.length) return null;
    return { avg: (r.reduce((s, x) => s + x.rating, 0) / r.length).toFixed(1), count: r.length };
  });

  // ---------------- Quick search ----------------
  readonly makes = computed(() => [...new Set(this.stock().map((v) => v.make))].sort());
  readonly bodies = computed(() => [...new Set(this.stock().filter((v) => v.category !== 'van').map((v) => v.bodyType))].sort());
  readonly budgets = [5000, 8000, 10000, 15000, 20000];
  search = { make: '', bodyType: '', maxPrice: '' };

  runSearch(): void {
    const qp: Record<string, string> = {};
    if (this.search.make) qp['make'] = this.search.make;
    if (this.search.bodyType) qp['bodyType'] = this.search.bodyType;
    if (this.search.maxPrice) qp['maxPrice'] = this.search.maxPrice;
    this.router.navigate(['/cars'], { queryParams: qp });
  }

  // ---------------- Stock grid + finance panel ----------------
  readonly chips: Chip[] = [
    { id: 'all', label: 'All', test: (v) => v.category !== 'van' },
    { id: 'suv', label: 'SUV', test: (v) => v.category !== 'van' && /suv|4x4/i.test(v.bodyType) },
    { id: 'hatch', label: 'Hatchback', test: (v) => v.category !== 'van' && /hatch/i.test(v.bodyType) },
    { id: 'estate', label: 'Estate', test: (v) => v.category !== 'van' && /estate/i.test(v.bodyType) },
    { id: 'auto', label: 'Automatic', test: (v) => v.category !== 'van' && v.transmission === 'Automatic' },
    { id: 'u10', label: 'Under £10k', test: (v) => v.category !== 'van' && v.price < 10000 },
    { id: 'reduced', label: 'Reduced', test: (v) => priceReduction(v) > 0 },
    { id: 'vans', label: 'Vans', test: (v) => v.category === 'van' },
  ];
  readonly chip = signal('all');
  readonly chipCounts = computed(() => {
    const s = this.stock();
    return Object.fromEntries(this.chips.map((c) => [c.id, s.filter(c.test).length]));
  });
  readonly grid = computed(() => {
    const c = this.chips.find((x) => x.id === this.chip()) ?? this.chips[0];
    return this.stock()
      .filter(c.test)
      .filter((v) => v.images?.length && !v.photosPending)
      .slice(0, 6);
  });
  readonly selectedId = signal<string | null>(null);
  readonly selected = computed<Vehicle | null>(() => {
    const g = this.grid();
    return g.find((v) => v.id === this.selectedId()) ?? g[0] ?? null;
  });
  readonly term = signal<number>(60);
  readonly terms = computed(() => {
    const v = this.selected();
    return v ? financeTermOptionsForPrice(v.price) : [];
  });
  readonly monthly = computed(() => this.terms().find((t) => t.termMonths === this.term())?.monthly);

  setChip(id: string): void {
    this.chip.set(id);
    this.selectedId.set(null);
  }

  badge(v: Vehicle): string | null {
    if (priceReduction(v)) return 'Reduced';
    if (v.isNew) return 'New in';
    if (meetsUlezStandard(v)) return 'ULEZ';
    return null;
  }

  srcset(v: Vehicle): string | null {
    return webpSrcset(v.thumbnailImage || v.images?.[0]);
  }

  // ---------------- Shop by type ----------------
  readonly types = computed(() => {
    const groups = new Map<string, Vehicle[]>();
    for (const v of this.stock()) {
      const key = v.category === 'van' ? 'Vans' : v.bodyType;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(v);
    }
    return [...groups.entries()]
      .map(([name, list]) => {
        const withPhoto = list.find((v) => v.images?.length && !v.photosPending);
        return {
          name,
          count: list.length,
          from: Math.min(...list.map((v) => v.price)),
          image: withPhoto?.thumbnailImage || withPhoto?.images?.[0] || null,
          link: name === 'Vans' ? ['/vans'] : ['/cars'],
          query: name === 'Vans' ? {} : { bodyType: name },
        };
      })
      .filter((t) => t.image)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  });

  // ---------------- Reviews + FAQ ----------------
  readonly reviews = computed(() => this.dealer.reviews().slice(0, 3));
  initials(name: string): string {
    return name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  }
  readonly faqs = [
    { q: 'Are your cars checked before they go on sale?', a: 'Yes. Every vehicle has a thorough multi-point safety inspection before we offer it for sale.' },
    { q: 'Do your cars come with a warranty?', a: 'Every vehicle comes with our own in-house warranty: no third parties and no call-centre queues.' },
    { q: 'Do you offer finance?', a: 'Yes. We are authorised and regulated by the Financial Conduct Authority and offer finance packages for all credit histories.' },
    { q: 'Can I see a car if I can’t get to Peterborough?', a: 'Yes. Ask for a video viewing on the car’s page and we will walk you round the car on a WhatsApp or FaceTime call. We also deliver across the UK.' },
  ];
  readonly openFaq = signal(0);

  // ---------------- Statement (words light up as you scroll) ----------------
  readonly statement = 'A family-run dealer with honest prices, cars we would buy ourselves and no pressure, ever.'.split(' ');
  readonly accentWords = new Set(['honest', 'prices,', 'no', 'pressure,', 'ever.']);
  readonly lit = signal(0);
  private readonly statementEl = viewChild<ElementRef<HTMLElement>>('statementRef');

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
          this.chapter.set(Math.min(3, Math.floor(p * 4)));
          const g = this.ghost()?.nativeElement;
          if (g) g.style.transform = `translate3d(${(-p * 18).toFixed(2)}vw,0,0)`;
          const rl = this.rail()?.nativeElement;
          if (rl) rl.style.transform = `scaleY(${p.toFixed(3)})`;
          const br = this.bar()?.nativeElement;
          if (br) br.style.transform = `scaleX(${p.toFixed(4)})`;
          document.documentElement.classList.toggle('prestige-over-film', r.bottom > 72);
        }
        const st = this.statementEl()?.nativeElement;
        if (st) {
          const r = st.getBoundingClientRect();
          const t = Math.max(0, Math.min(1, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
          this.lit.set(reduce ? this.statement.length : Math.round(t * this.statement.length));
        }
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
        document.documentElement.classList.remove('prestige-over-film');
      });
    });
  }

  formatPrice(n: number): string {
    return '£' + n.toLocaleString('en-GB');
  }
}
