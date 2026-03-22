import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BUSINESS_INFO } from '../../../data/reviews.data';
import { TrustedPartnersComponent } from '../trusted-partners/trusted-partners';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, TrustedPartnersComponent],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class FooterComponent {
  business = BUSINESS_INFO;
  currentYear = new Date().getFullYear();

  quickLinks = [
    { label: 'Used Cars', route: '/cars' },
    { label: 'Used Vans', route: '/vans' },
    { label: 'Finance Options', route: '/finance' },
    { label: 'Warranty', route: '/warranty' },
    { label: 'Sell Your Car', route: '/sell-your-car' },
    { label: 'Customer Reviews', route: '/reviews' },
  ];

  /** Same order as Fengate footer */
  legalLinks = [
    { label: 'Cookie Policy', route: '/legal/cookie-policy' },
    { label: 'Disclaimer', route: '/legal/disclaimer' },
    { label: 'Privacy Policy', route: '/legal/privacy-policy' },
    { label: 'Sitemap', route: '/legal/sitemap' },
  ];
}
