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
      // Already on screen (or scrolled past) when the page loads: leave it visible.
      // Hiding it and fading it back in is what made sections flash on load.
      const top = node.getBoundingClientRect().top;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (top < vh * 0.94) {
        node.classList.add('reveal-visible');
        return;
      }
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

      /** If the block is already on-screen (e.g. bottom of hero + tall viewport), IO can lag — reveal immediately. */
      const revealIfAlreadyInView = () => {
        if (node.classList.contains('reveal-visible')) return;
        const rect = node.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const vw = window.innerWidth || document.documentElement.clientWidth;
        const intersects =
          rect.bottom > 0 && rect.top < vh && rect.right > 0 && rect.left < vw;
        if (intersects) {
          node.classList.add('reveal-visible');
          this.observer?.unobserve(node);
        }
      };
      requestAnimationFrame(() => {
        revealIfAlreadyInView();
        requestAnimationFrame(revealIfAlreadyInView);
      });
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}
