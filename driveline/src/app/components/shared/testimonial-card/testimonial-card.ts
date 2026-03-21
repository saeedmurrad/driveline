import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Review } from '../../../models/review.model';

@Component({
  selector: 'app-testimonial-card',
  imports: [CommonModule],
  templateUrl: './testimonial-card.html',
  styleUrl: './testimonial-card.css',
})
export class TestimonialCardComponent {
  @Input({ required: true }) review!: Review;

  get stars(): number[] {
    return Array(this.review.rating).fill(0);
  }

  get emptyStars(): number[] {
    return Array(5 - this.review.rating).fill(0);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }
}
