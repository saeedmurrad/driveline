import { ThumbPipe } from '../../../pipes/thumb.pipe';
import { Component, PLATFORM_ID, computed, effect, inject } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { PhotoPendingComponent } from '../photo-pending/photo-pending';
import { COMPARE_LIMIT, GarageService } from '../../../services/garage.service';

/** Floating "compare" bar plus the small toast used by save / compare actions. */
@Component({
  selector: 'app-compare-tray',
  imports: [ThumbPipe, RouterLink, PhotoPendingComponent],
  templateUrl: './compare-tray.html',
})
export class CompareTrayComponent {
  protected readonly garage = inject(GarageService);
  private readonly router = inject(Router);
  protected readonly limit = COMPARE_LIMIT;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly onComparePage = computed(() => this.url().startsWith('/compare'));
  /** The vehicle page has its own sticky price bar on phones, so sit above it. */
  readonly onVehiclePage = computed(() => this.url().startsWith('/vehicle/'));
  readonly slots = computed(() =>
    Array.from({ length: this.limit }, (_, i) => this.garage.compareVehicles()[i]),
  );

  constructor() {
    // While the tray floats over the page, the footer gets extra room underneath (styles.css),
    // so the last lines of every page can be scrolled clear of it.
    const doc = inject(DOCUMENT);
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      effect(() => doc.documentElement.classList.toggle('has-compare-tray', this.garage.compareCount() > 0 && !this.onComparePage()));
    }
  }
}
