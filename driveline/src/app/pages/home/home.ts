import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VehicleService } from '../../services/vehicle.service';
import { VehicleCardComponent } from '../../components/vehicles/vehicle-card/vehicle-card';
import { SearchWidgetComponent } from '../../components/search/search-widget/search-widget';
import { TestimonialCardComponent } from '../../components/shared/testimonial-card/testimonial-card';
import { REVIEWS, BUSINESS_INFO } from '../../data/reviews.data';

@Component({
  selector: 'app-home',
  imports: [
    RouterLink,
    VehicleCardComponent,
    SearchWidgetComponent,
    TestimonialCardComponent,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomeComponent {
  private vehicleService = inject(VehicleService);

  featuredVehicles = this.vehicleService.featuredVehicles;
  reviews = REVIEWS.slice(0, 3);
  business = BUSINESS_INFO;

  stats = [
    { value: '500+', label: 'Cars Sold', icon: 'car' },
    { value: '18+', label: 'Years Experience', icon: 'clock' },
    { value: '5★', label: 'Average Rating', icon: 'star' },
    { value: '100%', label: 'Warranty Cover', icon: 'shield' },
  ];

  services = [
    {
      icon: 'search',
      title: 'Quality Vehicles',
      description:
        'Every vehicle undergoes a thorough multi-point safety inspection before being offered for sale.',
      link: '/cars',
      linkText: 'Browse Cars',
      color: 'blue',
    },
    {
      icon: 'currency',
      title: 'Flexible Finance',
      description:
        'FCA registered with competitive finance packages available to suit all budgets and circumstances.',
      link: '/finance',
      linkText: 'Learn More',
      color: 'green',
    },
    {
      icon: 'shield',
      title: 'Warranty Included',
      description:
        'Every vehicle comes with our own in-house warranty for complete peace of mind.',
      link: '/warranty',
      linkText: 'View Warranty',
      color: 'orange',
    },
    {
      icon: 'exchange',
      title: 'Part Exchange',
      description:
        'Get an excellent valuation for your current vehicle and use it as a deposit.',
      link: '/sell-your-car',
      linkText: 'Get Valuation',
      color: 'purple',
    },
  ];
}
