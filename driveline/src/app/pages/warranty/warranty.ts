import { Component, signal, inject, PLATFORM_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Web3FormsEnquiryService } from '../../services/web3forms-enquiry.service';
import { submitEnquiryWithWeb3Fallback } from '../../utils/submit-enquiry';

@Component({
  selector: 'app-warranty',
  imports: [RouterLink, FormsModule],
  templateUrl: './warranty.html',
  styleUrl: './warranty.css',
})
export class WarrantyComponent {
  private platformId = inject(PLATFORM_ID);
  private web3 = inject(Web3FormsEnquiryService);
  enquirySent = signal(false);
  enquirySubmitting = signal(false);
  enquiryError = signal<string | null>(null);

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
    const subject = 'Website enquiry — Warranty';
    const fromName =
      `${e.firstName} ${e.lastName}`.trim() || 'Website visitor';
    submitEnquiryWithWeb3Fallback(
      this.web3,
      this.platformId,
      {
        subject,
        message: body,
        replyEmail: e.email,
        fromName,
      },
      subject,
      body,
      {
        onSuccess: () => {
          this.enquirySent.set(true);
          this.enquiryError.set(null);
        },
        onError: (msg) => this.enquiryError.set(msg),
        setSubmitting: (v) => this.enquirySubmitting.set(v),
      },
    );
  }
}
