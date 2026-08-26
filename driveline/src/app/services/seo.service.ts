import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { DealerContextService } from './dealer-context.service';

interface SeoRouteData {
  title?: string;
  description?: string;
  titleKey?: string;
  descriptionKey?: string;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly dealerContext = inject(DealerContextService);

  constructor(@Inject(DOCUMENT) private readonly document: Document) {}

  init(): void {
    this.applyForRoute(this.router.routerState.snapshot.root);
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.applyForRoute(this.router.routerState.snapshot.root));
  }

  private dealerName(): string {
    return this.dealerContext.dealerName();
  }

  private location(): string {
    return this.dealerContext.locationLabel();
  }

  private resolveFromKey(key: string | undefined, kind: 'title' | 'description'): string {
    const name = this.dealerName();
    const loc = this.location();
    const map: Record<string, { title: string; description: string }> = {
      home: {
        title: `Used Cars & Vans in ${loc} | ${name}`,
        description: `Browse quality used cars and vans at ${name}. Finance, part exchange, warranties, and nationwide delivery.`,
      },
      cars: {
        title: `Used Cars for Sale in ${loc} | ${name}`,
        description: `View inspected used cars for sale at ${name}. Competitive prices, finance options, and warranty included.`,
      },
      vans: {
        title: `Used Vans for Sale in ${loc} | ${name}`,
        description: `Explore quality used vans from ${name}. Business-ready stock with finance and warranty options.`,
      },
      vehicle: {
        title: `Used Vehicle Details | ${name}`,
        description: `View full used vehicle specifications, images, finance examples, and enquiry options at ${name}.`,
      },
      finance: {
        title: `Car Finance | ${name}`,
        description: `Apply for used car and van finance with ${name}. Flexible finance packages and quick decisions.`,
      },
      warranty: {
        title: `Used Car Warranty | ${name}`,
        description: `Learn about warranty cover for used cars and vans from ${name}.`,
      },
      sell: {
        title: `Sell Your Car | ${name}`,
        description: `Get a competitive valuation to sell or part-exchange your car with ${name}.`,
      },
      reviews: {
        title: `Customer Reviews | ${name}`,
        description: `Read customer reviews for ${name} and see why buyers recommend us.`,
      },
      contact: {
        title: `Contact ${name}`,
        description: `Contact ${name} for used car and van enquiries, finance help, and test drives.`,
      },
      legal: {
        title: `Legal Information | ${name}`,
        description: `Legal pages including privacy policy, cookies, disclaimer, and site information.`,
      },
    };
    const entry = key ? map[key] : undefined;
    if (entry) return kind === 'title' ? entry.title : entry.description;
    return kind === 'title' ? name : `${name} — used cars and vans.`;
  }

  private applyForRoute(root: ActivatedRouteSnapshot): void {
    const seo = this.getSeoData(root);
    const title =
      seo?.title ||
      this.resolveFromKey(seo?.titleKey, 'title') ||
      this.dealerName();
    const description =
      seo?.description ||
      this.resolveFromKey(seo?.descriptionKey, 'description') ||
      `${this.dealerName()} — used cars and vans in ${this.location()}.`;

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
