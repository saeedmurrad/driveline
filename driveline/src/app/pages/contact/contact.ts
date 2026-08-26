import { Component, signal, inject, PLATFORM_ID, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { DealerContextService } from '../../services/dealer-context.service';
import { EnquirySubmitService } from '../../services/enquiry-submit.service';
import { validateEnquiryFields } from '../../utils/enquiry-validation';
import { scrollFormAlertIntoView } from '../../utils/scroll-form-alert';

@Component({
  selector: 'app-contact',
  imports: [RouterLink, FormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class ContactComponent {
  private platformId = inject(PLATFORM_ID);
  private enquirySubmit = inject(EnquirySubmitService);
  private dealerContext = inject(DealerContextService);

  business = this.dealerContext.businessInfo;
  dealerName = this.dealerContext.dealerName;
  salesMailtoHref = computed(
    () => `mailto:${this.dealerContext.salesEmail()}`,
  );
  mapsQuery = computed(() => {
    const b = this.business();
    if (!b) return '';
    return [
      b.address.line1,
      b.address.line2,
      b.address.town,
      b.address.postcode,
    ]
      .filter(Boolean)
      .join(', ');
  });
  mapsDirectionsUrl = computed(
    () => `https://maps.google.com/?q=${encodeURIComponent(this.mapsQuery())}`,
  );
  mapsEmbedUrl = computed(
    () =>
      `https://www.google.com/maps?q=${encodeURIComponent(this.mapsQuery())}&output=embed`,
  );
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
    const validationError = validateEnquiryFields(e, { requireMessage: true });
    if (validationError) {
      this.enquiryError.set(validationError);
      scrollFormAlertIntoView(this.platformId, 'contact-enquiry-alert');
      return;
    }
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
    void this.enquirySubmit.submit(
      {
        type: 'contact',
        subject,
        payload: {
          firstName: e.firstName,
          lastName: e.lastName,
          email: e.email,
          phone: e.phone,
          message: e.message,
          newsletterOptIn: e.newsletterOptIn,
        },
        mailtoSubject: subject,
        mailtoBody: body,
      },
      {
        onSuccess: () => {
          this.enquirySent.set(true);
          this.enquiryError.set(null);
        },
        onError: (msg) => {
          this.enquiryError.set(msg);
          scrollFormAlertIntoView(this.platformId, 'contact-enquiry-alert');
        },
        setSubmitting: (v) => this.enquirySubmitting.set(v),
      },
    );
  }
}
