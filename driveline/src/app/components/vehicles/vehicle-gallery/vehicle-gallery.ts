import {
  Component,
  DOCUMENT,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PHOTO_TAG_CODES, type PhotoTag, type Vehicle } from '../../../models/vehicle.model';
import { PhotoPendingComponent } from '../../shared/photo-pending/photo-pending';

const RESUME_KEY = 'dl.photo.';
const MAX_ZOOM = 3;

/**
 * Vehicle photo experience: desktop mosaic, phone swipe strip, and a full-screen viewer
 * with crossfade, pinch / double-tap zoom, drag, keyboard and an all-photos grid.
 */
@Component({
  selector: 'app-vehicle-gallery',
  imports: [PhotoPendingComponent],
  templateUrl: './vehicle-gallery.html',
  styleUrl: './vehicle-gallery.css',
})
export class VehicleGalleryComponent {
  @Input({ required: true }) set vehicleInput(v: Vehicle) {
    this.vehicle.set(v);
    this.category.set('all');
    this.index.set(0);
    this.stripIndex.set(0);
    this.closeViewer(false);
    this.resumeAt.set(this.readResume(v.id));
  }
  @Output() requestPhotos = new EventEmitter<void>();

  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly thumbs = viewChild<ElementRef<HTMLElement>>('thumbs');
  private readonly viewerEl = viewChild<ElementRef<HTMLElement>>('viewer');
  private readonly strip = viewChild<ElementRef<HTMLElement>>('strip');

  readonly vehicle = signal<Vehicle | null>(null);
  private readonly allImages = computed(() => this.vehicle()?.images ?? []);

  /** Category of each photo (same order as images), decoded from the sync's e/i/d string. */
  private readonly tags = computed(() => {
    const raw = this.vehicle()?.imageTags;
    return raw ? [...raw].map((c) => PHOTO_TAG_CODES[c] ?? 'detail') : null;
  });

  /** Photo category tabs (Exterior / Interior / Details), from the stock sync's photo tags. */
  readonly category = signal<'all' | PhotoTag>('all');
  readonly categories = computed(() => {
    const tags = this.tags();
    const all = this.allImages();
    if (!tags || tags.length !== all.length) return [];
    const labels: [PhotoTag, string][] = [['exterior', 'Exterior'], ['interior', 'Interior'], ['detail', 'Details']];
    const tabs = labels
      .map(([key, label]) => ({ key, label, count: tags.filter((t) => t === key).length }))
      .filter((t) => t.count > 0);
    // Tabs only help when there are at least two real groups to choose between.
    if (tabs.filter((t) => t.count >= 2).length < 2) return [];
    return [{ key: 'all' as const, label: 'All', count: all.length }, ...tabs];
  });
  readonly images = computed(() => {
    const all = this.allImages();
    const cat = this.category();
    const tags = this.tags();
    if (cat === 'all' || !tags || !this.categories().length) return all;
    return all.filter((_, i) => tags[i] === cat);
  });
  readonly categoryLabel = computed(() => this.categories().find((c) => c.key === this.category())?.label ?? '');
  readonly count = computed(() => this.images().length);
  readonly title = computed(() => {
    const v = this.vehicle();
    return v ? `${v.year} ${v.make} ${v.model}` : '';
  });
  /** Side tiles: four in a 2×2 block, or a single column of up to two for small groups. */
  readonly tiles = computed(() => this.images().slice(1, this.count() < 5 ? 3 : 5));
  readonly moreCount = computed(() => Math.max(0, this.count() - 1 - this.tiles().length));
  readonly mosaicRows = computed(() => (this.count() < 5 ? Math.max(1, this.tiles().length) : 2));

  readonly open = signal(false);
  readonly gridMode = signal(false);
  readonly index = signal(0);
  readonly stripIndex = signal(0);
  readonly resumeAt = signal(0);

  // Zoom and pan inside the viewer
  readonly scale = signal(1);
  readonly panX = signal(0);
  readonly panY = signal(0);
  readonly swipeX = signal(0);
  readonly transform = computed(
    () => `translate3d(${this.panX() + this.swipeX()}px, ${this.panY()}px, 0) scale(${this.scale()})`,
  );

  private returnFocus: HTMLElement | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchStart = { dist: 0, scale: 1 };
  private dragStart = { x: 0, y: 0, panX: 0, panY: 0 };
  private lastTap = 0;

  constructor() {
    // Keep the active thumbnail in view and remember the photo for "continue viewing".
    effect(() => {
      const i = this.index();
      if (!this.open() || !this.browser) return;
      const strip = this.thumbs()?.nativeElement;
      strip?.querySelector<HTMLElement>(`[data-thumb="${i}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      const id = this.vehicle()?.id;
      if (id && this.category() === 'all') this.writeResume(id, i);
      this.preload(i + 1);
      this.preload(i - 1);
    });
  }

  /** Switch photo tab; in the viewer this jumps to the first photo of that group. */
  setCategory(key: 'all' | PhotoTag): void {
    if (key === this.category()) return;
    this.category.set(key);
    this.resetZoom();
    this.index.set(0);
    this.stripIndex.set(0);
    this.strip()?.nativeElement.scrollTo({ left: 0 });
  }

  // ---------- viewer ----------

  openViewer(at = 0, grid = false): void {
    if (!this.count()) return;
    this.returnFocus = this.browser ? (this.document.activeElement as HTMLElement | null) : null;
    this.index.set(this.wrap(at));
    this.gridMode.set(grid);
    this.resetZoom();
    this.open.set(true);
    if (this.browser) {
      this.document.body.style.overflow = 'hidden';
      setTimeout(() => this.viewerEl()?.nativeElement.focus(), 0);
    }
  }

  closeViewer(restoreFocus = true): void {
    if (!this.open()) return;
    this.open.set(false);
    this.gridMode.set(false);
    if (this.browser) {
      this.document.body.style.overflow = '';
      if (restoreFocus) this.returnFocus?.focus?.();
    }
  }

  go(delta: number): void {
    this.resetZoom();
    this.index.update((i) => this.wrap(i + delta));
  }

  goTo(i: number): void {
    this.resetZoom();
    this.index.set(this.wrap(i));
    this.gridMode.set(false);
  }

  onKey(e: KeyboardEvent): void {
    if (!this.open()) return;
    const k = e.key;
    if (k === 'ArrowRight') this.go(1);
    else if (k === 'ArrowLeft') this.go(-1);
    else if (k === 'Home') this.goTo(0);
    else if (k === 'End') this.goTo(this.count() - 1);
    else if (k === 'g' || k === 'G') this.gridMode.update((g) => !g);
    else if (k === 'Tab') this.trapFocus(e);
    else return;
    if (k !== 'Tab') e.preventDefault();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.gridMode() && this.open()) this.gridMode.set(false);
    else this.closeViewer();
  }

  // ---------- gestures on the stage ----------

  onPointerDown(e: PointerEvent): void {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      this.pinchStart = { dist: this.pointerDistance(), scale: this.scale() };
    } else if (this.pointers.size === 1) {
      this.dragStart = { x: e.clientX, y: e.clientY, panX: this.panX(), panY: this.panY() };
      // Double tap / double click toggles 2× zoom at the tapped point.
      const now = Date.now();
      if (now - this.lastTap < 280) {
        this.toggleZoomAt(e.clientX, e.clientY);
        this.lastTap = 0;
      } else {
        this.lastTap = now;
      }
    }
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2 && this.pinchStart.dist > 0) {
      const next = (this.pinchStart.scale * this.pointerDistance()) / this.pinchStart.dist;
      this.scale.set(Math.min(MAX_ZOOM, Math.max(1, next)));
      if (this.scale() === 1) this.resetPan();
      return;
    }
    const dx = e.clientX - this.dragStart.x;
    const dy = e.clientY - this.dragStart.y;
    if (this.scale() > 1) {
      this.panX.set(this.dragStart.panX + dx);
      this.panY.set(this.dragStart.panY + dy);
      this.clampPan();
    } else {
      this.swipeX.set(dx);
    }
  }

  onPointerUp(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) {
      const dx = this.swipeX();
      this.swipeX.set(0);
      if (this.scale() === 1 && Math.abs(dx) > 50) this.go(dx < 0 ? 1 : -1);
    }
    if (this.pointers.size < 2) this.pinchStart = { dist: 0, scale: this.scale() };
  }

  onWheel(e: WheelEvent): void {
    if (!e.ctrlKey) return; // trackpad pinch arrives as ctrl+wheel
    e.preventDefault();
    this.scale.set(Math.min(MAX_ZOOM, Math.max(1, this.scale() * (e.deltaY < 0 ? 1.08 : 0.92))));
    if (this.scale() === 1) this.resetPan();
  }

  zoomIn(): void {
    this.scale.set(this.scale() > 1 ? 1 : 2);
    if (this.scale() === 1) this.resetPan();
  }

  // ---------- phone strip ----------

  onStripScroll(): void {
    const el = this.strip()?.nativeElement;
    if (!el) return;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (i !== this.stripIndex()) this.stripIndex.set(i);
  }

  // ---------- helpers ----------

  private toggleZoomAt(x: number, y: number): void {
    if (this.scale() > 1) {
      this.resetZoom();
      return;
    }
    const rect = this.stage()?.nativeElement.getBoundingClientRect();
    this.scale.set(2);
    if (rect) {
      this.panX.set((rect.left + rect.width / 2 - x) * 1);
      this.panY.set((rect.top + rect.height / 2 - y) * 1);
      this.clampPan();
    }
  }

  private clampPan(): void {
    const rect = this.stage()?.nativeElement.getBoundingClientRect();
    if (!rect) return;
    const maxX = (rect.width * (this.scale() - 1)) / 2;
    const maxY = (rect.height * (this.scale() - 1)) / 2;
    this.panX.set(Math.max(-maxX, Math.min(maxX, this.panX())));
    this.panY.set(Math.max(-maxY, Math.min(maxY, this.panY())));
  }

  private resetPan(): void {
    this.panX.set(0);
    this.panY.set(0);
  }

  private resetZoom(): void {
    this.scale.set(1);
    this.resetPan();
    this.swipeX.set(0);
  }

  private pointerDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private wrap(i: number): number {
    const n = this.count();
    return n ? ((i % n) + n) % n : 0;
  }

  private preload(i: number): void {
    if (!this.browser || !this.count()) return;
    const img = new Image();
    img.src = this.images()[this.wrap(i)];
  }

  private trapFocus(e: KeyboardEvent): void {
    const root = this.viewerEl()?.nativeElement;
    if (!root) return;
    const items = [...root.querySelectorAll<HTMLElement>('button:not([disabled])')];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = this.document.activeElement;
    if (e.shiftKey && (active === first || active === root)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  private readResume(id: string): number {
    if (!this.browser) return 0;
    try {
      const n = Number(localStorage.getItem(RESUME_KEY + id));
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }

  private writeResume(id: string, i: number): void {
    try {
      localStorage.setItem(RESUME_KEY + id, String(i));
    } catch {
      // storage unavailable: not essential
    }
  }
}
