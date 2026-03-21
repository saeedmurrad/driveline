import { Component, signal, inject, PLATFORM_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { openSalesEnquiryEmail } from '../../utils/enquiry-mailto';

@Component({
  selector: 'app-warranty',
  imports: [RouterLink, FormsModule],
  templateUrl: './warranty.html',
  styleUrl: './warranty.css',
})
export class WarrantyComponent {
  private platformId = inject(PLATFORM_ID);
  enquirySent = signal(false);

  enquiry = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    vehicleDetails: '',
    message: '',
    newsletterOptIn: false,
  };

  warrantyFeatures = [
    {
      icon: 'shield',
      title: 'In-House Warranty',
      description:
        'We take full responsibility for your warranty - no third parties, no hold queues, no fuss.',
    },
    {
      icon: 'phone',
      title: 'Direct Support',
      description:
        'Call us directly and we\'ll handle everything. No email chains or lengthy approval processes.',
    },
    {
      icon: 'location',
      title: 'UK-Wide Coverage',
      description:
        'Whether you\'re local or further afield, we\'ll quickly arrange to get your vehicle fixed.',
    },
    {
      icon: 'clock',
      title: 'Fast Resolution',
      description:
        'We understand you need your car. Our team works quickly to minimise any downtime.',
    },
  ];

  submitEnquiry() {
    const e = this.enquiry;
    const body = [
      `Name: ${e.firstName} ${e.lastName}`,
      `Email: ${e.email}`,
      `Phone: ${e.phone}`,
      `Vehicle: ${e.vehicleDetails || '—'}`,
      `Newsletter opt-in: ${e.newsletterOptIn ? 'Yes' : 'No'}`,
      '',
      'Message:',
      e.message,
    ].join('\n');
    if (isPlatformBrowser(this.platformId)) {
      openSalesEnquiryEmail('Website enquiry — Warranty', body);
    }
    this.enquirySent.set(true);
  }
}
