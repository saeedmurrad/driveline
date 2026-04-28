import { isPlatformBrowser, NgClass } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { VehicleService } from '../../services/vehicle.service';
import { VehicleCardComponent } from '../../components/vehicles/vehicle-card/vehicle-card';
import { SearchWidgetComponent } from '../../components/search/search-widget/search-widget';
import { TestimonialCardComponent } from '../../components/shared/testimonial-card/testimonial-card';
import { RevealOnScrollDirective } from '../../directives/reveal-on-scroll.directive';
import { REVIEWS, BUSINESS_INFO } from '../../data/reviews.data';

@Component({
  selector: 'app-home',
  imports: [
    NgClass,
    RouterLink,
    VehicleCardComponent,
    SearchWidgetComponent,
    TestimonialCardComponent,
    RevealOnScrollDirective,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomeComponent {
  private vehicleService = inject(VehicleService);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);

  featuredVehicles = this.vehicleService.featuredVehicles;
  reviews = REVIEWS.slice(0, 3);
  business = BUSINESS_INFO;

  /**
   * Hero backgrounds sourced from user-provided image URLs and stored in `public/hero/*`.
   */
  readonly heroSlides: readonly { src: string; alt: string }[] = [
    { src: 'hero/hero-01.jpeg', alt: '' },
    { src: 'hero/hero-02.jpeg', alt: '' },
    { src: 'hero/hero-03.jpeg', alt: '' },
    { src: 'hero/hero-04.jpeg', alt: '' },
    { src: 'hero/hero-05.jpeg', alt: '' },
    { src: 'hero/hero-06.jpeg', alt: '' },
    { src: 'hero/hero-07.jpeg', alt: '' },
    { src: 'hero/hero-08.jpeg', alt: '' },
    { src: 'hero/hero-09.jpeg', alt: '' },
    { src: 'hero/hero-10.jpeg', alt: '' },
  ];

  heroActiveIndex = signal(0);
  private heroRotateTimer: number | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.heroRotateTimer !== undefined) clearInterval(this.heroRotateTimer);
    });
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      this.heroRotateTimer = window.setInterval(() => {
        this.heroActiveIndex.update((i) => (i + 1) % this.heroSlides.length);
      }, 8000);
    });
  }

  setHeroSlide(index: number): void {
    const n = this.heroSlides.length;
    if (n === 0) return;
    this.heroActiveIndex.set(((index % n) + n) % n);
  }

  stats = [
    { value: '500+', label: 'Cars Sold', icon: 'car' },
    { value: '18+', label: 'Years Experience', icon: 'clock' },
    { value: '5★', label: 'Average Rating', icon: 'star' },
    { value: '100%', label: 'Warranty Cover', icon: 'shield' },
  ];
}
