import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Standard page header (breadcrumb, title, lead) used by content pages. */
@Component({
  selector: 'app-page-header',
  imports: [RouterLink],
  template: `
    <!-- data-ghost: the Forecourt theme writes the page name in giant outline behind the banner -->
    <div class="page-header" [attr.data-ghost]="crumb">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav class="mb-3 flex items-center gap-2 text-sm text-rose-200" aria-label="Breadcrumb">
          <a routerLink="/" class="transition-colors hover:text-white">Home</a>
          @if (parentLabel && parentLink) {
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            <a [routerLink]="parentLink" class="transition-colors hover:text-white">{{ parentLabel }}</a>
          }
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          <span class="text-white" aria-current="page">{{ crumb }}</span>
        </nav>
        <h1 class="page-title mb-3">{{ title }}</h1>
        @if (lead) {
          <p class="max-w-2xl text-lg text-rose-100/90">{{ lead }}</p>
        }
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) crumb!: string;
  @Input() lead = '';
  @Input() parentLabel = '';
  @Input() parentLink = '';
}
