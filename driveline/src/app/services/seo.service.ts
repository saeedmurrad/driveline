import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

interface SeoRouteData {
  title?: string;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  constructor(@Inject(DOCUMENT) private readonly document: Document) {}

  init(): void {
    this.applyForRoute(this.router.routerState.snapshot.root);
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.applyForRoute(this.router.routerState.snapshot.root));
  }

  private applyForRoute(root: ActivatedRouteSnapshot): void {
    const seo = this.getSeoData(root);
    const title = seo?.title || 'DriveLine Car Sales';
    const description =
      seo?.description ||
      'DriveLine Car Sales in Peterborough: used cars and vans with finance, part exchange, and warranty.';

    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });

    if (!isPlatformBrowser(this.platformId)) return;
    const canonical = `${window.location.origin}${window.location.pathname}`;
    this.updateCanonical(canonical);
    this.meta.updateTag({ property: 'og:url', content: canonical });
  }

  private getSeoData(route: ActivatedRouteSnapshot): SeoRouteData | null {
    let current: ActivatedRouteSnapshot | null = route;
    let found: SeoRouteData | null = null;
    while (current) {
      const candidate = (current.data?.['seo'] as SeoRouteData | undefined) || null;
      if (candidate) found = candidate;
      current = current.firstChild ?? null;
    }
    return found;
  }

  private updateCanonical(url: string): void {
    let link = this.document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
