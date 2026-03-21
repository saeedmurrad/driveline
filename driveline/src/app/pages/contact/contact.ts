import { Component, signal, inject, PLATFORM_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { BUSINESS_INFO } from '../../data/reviews.data';
import { openSalesEnquiryEmail } from '../../utils/enquiry-mailto';

@Component({
  selector: 'app-contact',
  imports: [RouterLink, FormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class ContactComponent {
  private platformId = inject(PLATFORM_ID);
  business = BUSINESS_INFO;
  enquirySent = signal(false);

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
    if (isPlatformBrowser(this.platformId)) {
      openSalesEnquiryEmail('Website enquiry — Contact page', body);
    }
    this.enquirySent.set(true);
  }
}
