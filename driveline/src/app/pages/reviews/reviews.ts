import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DealerContextService } from '../../services/dealer-context.service';
import { TestimonialCardComponent } from '../../components/shared/testimonial-card/testimonial-card';

@Component({
  selector: 'app-reviews',
  imports: [RouterLink, TestimonialCardComponent],
  templateUrl: './reviews.html',
  styleUrl: './reviews.css',
})
export class ReviewsComponent {
  private readonly dealerContext = inject(DealerContextService);
  reviews = this.dealerContext.reviews;

  averageRating = computed(() => {
    const list = this.reviews();
    if (!list.length) return 5;
    return list.reduce((sum, r) => sum + r.rating, 0) / list.length;
  });
}
