import { Component, signal, inject, PLATFORM_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { BUSINESS_INFO } from '../../data/reviews.data';
import { TrustedPartnersComponent } from '../../components/layout/trusted-partners/trusted-partners';
import { Web3FormsEnquiryService } from '../../services/web3forms-enquiry.service';
import { submitEnquiryWithWeb3Fallback } from '../../utils/submit-enquiry';

@Component({
  selector: 'app-contact',
  imports: [RouterLink, FormsModule, TrustedPartnersComponent],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class ContactComponent {
  private platformId = inject(PLATFORM_ID);
  private web3 = inject(Web3FormsEnquiryService);
  business = BUSINESS_INFO;
  enquirySent = signal(false);
  enquirySubmitting = signal(false);
  enquiryError = signal<string | null>(null);

  enquiry = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    message: '',
    newsletterOptIn: false,
  };

  isOpenNow(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    const now = new Date();
    const day = now.getDay();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;
    const isSunday = day === 0;
    const open = isSunday ? 10 * 60 : 9 * 60;
    const close = isSunday ? 16 * 60 : 18 * 60;
    return currentTime >= open && currentTime < close;
  }

  submitEnquiry() {
    const e = this.enquiry;
    const body = [
      `Name: ${e.firstName} ${e.lastName}`,
      `Email: ${e.email}`,
      `Phone: ${e.phone}`,
      `Newsletter opt-in: ${e.newsletterOptIn ? 'Yes' : 'No'}`,
      '',
      'Message:',
      e.message,
    ].join('\n');
    const subject = 'Website enquiry — Contact page';
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
