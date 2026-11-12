import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DealerContextService } from '../../../services/dealer-context.service';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class FooterComponent {
  private readonly dealerContext = inject(DealerContextService);

  business = computed(() => this.dealerContext.businessInfo());
  salesMailtoHref = computed(
    () => `mailto:${this.dealerContext.salesEmail()}`,
  );
  dealerName = computed(() => this.dealerContext.dealerName());
  currentYear = new Date().getFullYear();

  quickLinks = [
    { label: 'Used Cars', route: '/cars' },
    { label: 'Used Vans', route: '/vans' },
    { label: 'Finance Options', route: '/finance' },
    { label: 'Warranty', route: '/warranty' },
    { label: 'Sell Your Car', route: '/sell-your-car' },
    { label: 'Free MOT & DVLA Check', route: '/mot-check' },
    { label: 'Customer Reviews', route: '/reviews' },
    { label: 'Part Exchange', route: '/part-exchange' },
    { label: 'Delivery & Collection', route: '/delivery' },
    { label: 'FAQ', route: '/faq' },
  ];

  legalLinks = [
    { label: 'Cookie Policy', route: '/legal/cookie-policy' },
    { label: 'Disclaimer', route: '/legal/disclaimer' },
    { label: 'Privacy Policy', route: '/legal/privacy-policy' },
    { label: 'Sitemap', route: '/legal/sitemap' },
  ];
}
