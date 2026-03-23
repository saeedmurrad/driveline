import {
  Directive,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  afterNextRender,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Fades/slides the host into view once when it enters the viewport.
 * Respects prefers-reduced-motion via global CSS (.reveal-init / .reveal-visible).
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
})
export class RevealOnScrollDirective implements OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private platformId = inject(PLATFORM_ID);
  private observer: IntersectionObserver | null = null;

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) {
        this.el.nativeElement.classList.add('reveal-visible');
        return;
      }
      const node = this.el.nativeElement;
      node.classList.add('reveal-init');
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('reveal-visible');
              this.observer?.unobserve(entry.target);
            }
          }
        },
        { root: null, rootMargin: '0px 0px -6% 0px', threshold: 0.06 },
      );
      this.observer.observe(node);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}
