import { Component, EventEmitter, Input, OnInit, Output, PLATFORM_ID, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PhotoPendingComponent } from '../photo-pending/photo-pending';
import type { Vehicle } from '../../../models/vehicle.model';
import { EnquirySubmitService } from '../../../services/enquiry-submit.service';
import { validateEnquiryFields } from '../../../utils/enquiry-validation';
import { scrollFormAlertIntoView } from '../../../utils/scroll-form-alert';
import { formatGbp } from '../../../utils/vehicle-insights';

export type VisitRequestKind = 'test-drive' | 'reserve' | 'video';

const COPY: Record<VisitRequestKind, { title: string; lead: string; button: string; done: string }> = {
  'test-drive': {
    title: 'Book a test drive',
    lead: 'Pick a day and time that suits you. We will confirm by phone or email, and have the car ready and warmed up.',
    button: 'Request test drive',
    done: 'Test drive requested. We will confirm the time shortly.',
  },
  reserve: {
    title: 'Reserve this vehicle',
    lead: 'Ask us to hold it for you while you arrange a visit or finance. No payment is taken online, and it is only reserved once we confirm.',
    button: 'Request reservation',
    done: 'Reservation requested. We will call you to confirm the hold.',
  },
  video: {
    title: 'Live video viewing',
    lead: 'Can’t get to Peterborough? We will walk you round the car on a WhatsApp or FaceTime video call, start it up and answer your questions.',
    button: 'Request video call',
    done: 'Video viewing requested. We will message you to arrange it.',
  },
};

@Component({
  selector: 'app-visit-request',
  imports: [FormsModule, PhotoPendingComponent],
  templateUrl: './visit-request.html',
})
export class VisitRequestComponent implements OnInit {
  @Input({ required: true }) vehicle!: Vehicle;
  @Input() kind: VisitRequestKind = 'test-drive';
  @Output() dismiss = new EventEmitter<void>();

  private readonly enquirySubmit = inject(EnquirySubmitService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly sent = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly timeSlots = ['Morning (9–12)', 'Afternoon (12–3)', 'Late afternoon (3–6)'];
  readonly contactPrefs = ['Phone call', 'WhatsApp', 'Email'];

  form = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    date: '',
    time: 'Morning (9–12)',
    contact: 'Phone call',
    partExchange: false,
    finance: false,
    message: '',
  };

  minDate = '';

  get copy() {
    return COPY[this.kind];
  }

  ngOnInit(): void {
    const today = new Date();
    this.minDate = today.toISOString().slice(0, 10);
    const tomorrow = new Date(today.getTime() + 86_400_000);
    this.form.date = tomorrow.toISOString().slice(0, 10);
  }

  submit(): void {
    const f = this.form;
    const invalid = validateEnquiryFields(f);
    if (invalid) {
      this.error.set(invalid);
      scrollFormAlertIntoView(this.platformId, 'visit-request-alert');
      return;
    }
    const v = this.vehicle;
    const vehicleLine = `${v.year} ${v.make} ${v.model} ${v.derivative} · Stock ref ${v.id} · ${formatGbp(v.price)}`;
    const when =
      this.kind === 'reserve'
        ? `Planning to visit: ${f.date || 'not given'}, ${f.time}`
        : `Preferred: ${f.date || 'not given'}, ${f.time}`;
    const body = [
      `${this.copy.title}: ${vehicleLine}`,
      '',
      `Name: ${f.firstName} ${f.lastName}`,
      `Email: ${f.email}`,
      `Phone: ${f.phone}`,
      `Contact by: ${f.contact}`,
      when,
      `Has a part exchange: ${f.partExchange ? 'Yes' : 'No'}`,
      `Interested in finance: ${f.finance ? 'Yes' : 'No'}`,
      '',
      'Notes:',
      f.message || '—',
    ].join('\n');
    const subject = `${this.copy.title} — ${v.year} ${v.make} ${v.model}`;
    void this.enquirySubmit.submit(
      {
        type: this.kind,
        subject,
        payload: { ...f, body, vehicleLine },
        vehicleId: v.id,
        mailtoSubject: subject,
        mailtoBody: body,
      },
      {
        onSuccess: () => {
          this.sent.set(true);
          this.error.set(null);
        },
        onError: (msg) => {
          this.error.set(msg);
          scrollFormAlertIntoView(this.platformId, 'visit-request-alert');
        },
        setSubmitting: (val) => this.submitting.set(val),
      },
    );
  }
}
