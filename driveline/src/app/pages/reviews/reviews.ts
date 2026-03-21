import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { REVIEWS } from '../../data/reviews.data';
import { TestimonialCardComponent } from '../../components/shared/testimonial-card/testimonial-card';

@Component({
  selector: 'app-reviews',
  imports: [RouterLink, TestimonialCardComponent],
  templateUrl: './reviews.html',
  styleUrl: './reviews.css',
})
export class ReviewsComponent {
  reviews = REVIEWS;

  get averageRating(): number {
    return this.reviews.reduce((sum, r) => sum + r.rating, 0) / this.reviews.length;
  }
}
