import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Web3FormsEnquiryService } from '../../../services/web3forms-enquiry.service';
import { submitEnquiryWithWeb3Fallback } from '../../../utils/submit-enquiry';
import { validateEnquiryFields } from '../../../utils/enquiry-validation';
import { scrollFormAlertIntoView } from '../../../utils/scroll-form-alert';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { Vehicle } from '../../../models/vehicle.model';
import type { DvlaVehicleDetails } from '../../../models/dvla-vehicle.model';
import { DvlaVehicleService } from '../../../services/dvla-vehicle.service';

@Component({
  selector: 'app-part-exchange-form',
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './part-exchange-form.html',
  styleUrl: './part-exchange-form.css',
})
export class PartExchangeFormComponent {
  private platformId = inject(PLATFORM_ID);
  private dvlaVehicle = inject(DvlaVehicleService);
  private web3 = inject(Web3FormsEnquiryService);

  /** Full sell-your-car page vs compact modal on vehicle detail */
  @Input() variant: 'page' | 'modal' = 'page';
  /** When set, user is part-exchanging toward this stock vehicle */
  @Input() vehicleOfInterest: Vehicle | null = null;

  @Output() dismiss = new EventEmitter<void>();

  currentStep = signal(1);
  isSubmitted = signal(false);

  /** DVLA registration lookup */
  registrationLookupLoading = signal(false);
  registrationLookupError = signal<string | null>(null);
  dvlaVehicleDetails = signal<DvlaVehicleDetails | null>(null);
  submitSending = signal(false);
  submitError = signal<string | null>(null);
  /** Step 1: missing required fields when user clicks Next */
  step1FieldsError = signal<string | null>(null);

  vehicle = {
    registration: '',
    mileage: undefined as number | undefined,
    make: '',
    model: '',
    derivative: '',
    colour: '',
    fuel: '',
    gearbox: '',
    numberOfOwners: undefined as number | undefined,
    motExpiry: '',
    serviceHistory: '',
    condition: '',
    usedAsTaxi: false,
    transportedAnimals: false,
    usedBySmoker: false,
    additionalDetails: '',
  };

  contact = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    postcode: '',
    newsletterOptIn: false,
  };

  serviceHistoryOptions = [
    'Full',
    'Part',
    'First Service',
    'Not Yet Due',
    'None',
  ];
  conditionOptions = ['Excellent', 'Good', 'Average', 'Poor'];
  fuelOptions = ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'Plug-in Hybrid'];
  gearboxOptions = ['Manual', 'Automatic'];

  lookupVehicle(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.registrationLookupError.set(null);
    this.step1FieldsError.set(null);
    this.dvlaVehicleDetails.set(null);
    this.registrationLookupLoading.set(true);

    this.dvlaVehicle
      .lookupByRegistration(this.vehicle.registration)
      .pipe(finalize(() => this.registrationLookupLoading.set(false)))
      .subscribe({
        next: (data) => {
          this.dvlaVehicleDetails.set(data);
          this.applyDvlaToForm(data);
        },
        error: (err: unknown) => {
          const message =
            err instanceof Error ? err.message : 'Registration lookup failed.';
          this.registrationLookupError.set(message);
        },
      });
  }

  /**
   * Maps DVLA Vehicle Enquiry fields only. Model, mileage, gearbox, owners, trim/spec
   * are left for the user — engine size appears on the DVLA summary card, not in derivative.
   */
  private applyDvlaToForm(d: DvlaVehicleDetails): void {
    if (d.registrationNumber) {
      this.vehicle.registration = d.registrationNumber.toUpperCase();
    }
    this.vehicle.make = this.toTitleCase(d.make);
    this.vehicle.model = '';
    this.vehicle.derivative = '';
    this.vehicle.colour = d.colour?.trim() || '';
    this.vehicle.fuel = this.mapDvlaFuelToForm(d.fuelType);

    if (d.motExpiryDate) {
      this.vehicle.motExpiry = d.motExpiryDate;
    }
  }

  private toTitleCase(value?: string): string {
    if (!value?.trim()) return '';
    return value
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  /** Align DVLA fuel strings with form select options. */
  private mapDvlaFuelToForm(fuel?: string): string {
    if (!fuel) return '';
    const u = fuel.toUpperCase();
    if (u.includes('DIESEL')) return 'Diesel';
    if (u.includes('PETROL') || u === 'GAS') return 'Petrol';
    // Before plain "Electric" — DVLA often uses "PLUGIN HYBRID ELECTRIC" etc.
    if (u.includes('HYBRID') && (u.includes('PLUGIN') || u.includes('PHEV')))
      return 'Plug-in Hybrid';
    if (u.includes('ELECTRIC')) return 'Electric';
    if (u.includes('HYBRID')) return 'Hybrid';
    const t = this.toTitleCase(fuel);
    return this.fuelOptions.includes(t) ? t : '';
  }

  nextStep() {
    const step = this.currentStep();
    if (step === 1 && !this.validateStep1()) {
      scrollFormAlertIntoView(this.platformId, 'part-exchange-step1-alert');
      return;
    }
    this.step1FieldsError.set(null);
    this.currentStep.update((s) => Math.min(s + 1, 3));
  }

  prevStep() {
    this.step1FieldsError.set(null);
    this.currentStep.update((s) => Math.max(s - 1, 1));
  }

  /** DVLA fills some fields; we always require mileage, model, fuel & gearbox from the user. */
  private validateStep1(): boolean {
    const v = this.vehicle;
    const missing: string[] = [];
    if (v.mileage == null || Number.isNaN(Number(v.mileage)) || Number(v.mileage) < 0) {
      missing.push('Mileage');
    }
    if (!v.make?.trim()) {
      missing.push('Make');
    }
    if (!v.model?.trim()) {
      missing.push('Model');
    }
    if (!v.fuel?.trim()) {
      missing.push('Fuel type');
    }
    if (!v.gearbox?.trim()) {
      missing.push('Gearbox');
    }
    if (missing.length > 0) {
      this.step1FieldsError.set(
        `Please complete: ${missing.join(', ')}. Use Look up to pre-fill DVLA data where possible, then add the rest.`,
      );
      return false;
    }
    return true;
  }

  submitForm() {
    const vo = this.vehicleOfInterest;
    const v = this.vehicle;
    const c = this.contact;
    const dvla = this.dvlaVehicleDetails();
    const subject = vo
      ? `Part exchange — ${vo.year} ${vo.make} ${vo.model} (stock ${vo.id})`
      : 'Sell your car — valuation request';
    const body = [
      vo
        ? `Customer interested in: ${vo.year} ${vo.make} ${vo.model} ${vo.derivative} · Stock ${vo.id}`
        : 'Sell your car / part exchange valuation',
      '',
      dvla
        ? [
            '--- DVLA record (at time of enquiry) ---',
            `Registration: ${dvla.registrationNumber || '—'}`,
            `Make: ${dvla.make || '—'}`,
            `Year of manufacture: ${dvla.yearOfManufacture ?? '—'}`,
            `Colour: ${dvla.colour || '—'}`,
            `Fuel (DVLA): ${dvla.fuelType || '—'}`,
            `Engine: ${dvla.engineCapacity != null ? `${dvla.engineCapacity}cc` : '—'}`,
            `Tax: ${dvla.taxStatus || '—'}`,
            `MOT: ${dvla.motStatus || '—'}${dvla.motExpiryDate ? ` (exp. ${dvla.motExpiryDate})` : ''}`,
            '',
          ].join('\n')
        : '',
      '--- Vehicle offered (form) ---',
      `Registration: ${v.registration || '—'}`,
      `Mileage: ${v.mileage?.toLocaleString('en-GB') ?? '—'}`,
      `Make / model: ${v.make} ${v.model} ${v.derivative}`.trim(),
      `Colour: ${v.colour || '—'}`,
      `Fuel: ${v.fuel || '—'}`,
      `Gearbox: ${v.gearbox}`,
      `Owners: ${v.numberOfOwners ?? '—'}`,
      `MOT expiry: ${v.motExpiry || '—'}`,
      `Service history: ${v.serviceHistory || '—'}`,
      `Condition: ${v.condition || '—'}`,
      `Used as taxi: ${v.usedAsTaxi ? 'Yes' : 'No'}`,
      `Transported animals: ${v.transportedAnimals ? 'Yes' : 'No'}`,
      `Used by smoker: ${v.usedBySmoker ? 'Yes' : 'No'}`,
      v.additionalDetails ? `Additional details:\n${v.additionalDetails}` : '',
      '',
      '--- Contact ---',
      `Name: ${c.firstName} ${c.lastName}`,
      `Email: ${c.email}`,
      `Phone: ${c.phone}`,
      `Postcode: ${c.postcode || '—'}`,
      `Newsletter opt-in: ${c.newsletterOptIn ? 'Yes' : 'No'}`,
    ]
      .filter((line) => line !== '')
      .join('\n');
    const fromName =
      `${c.firstName} ${c.lastName}`.trim() || 'Website visitor';
    submitEnquiryWithWeb3Fallback(
      this.web3,
      this.platformId,
      {
        subject,
        message: body,
        replyEmail: c.email,
        fromName,
      },
      subject,
      body,
      {
        onSuccess: () => {
          this.isSubmitted.set(true);
          this.submitError.set(null);
        },
        onError: (msg) => {
          this.submitError.set(msg);
          scrollFormAlertIntoView(this.platformId, 'part-exchange-submit-alert');
        },
        setSubmitting: (v) => this.submitSending.set(v),
      },
    );
  }

  onModalDone() {
    this.dismiss.emit();
  }

  get stepTitle(): string {
    const titles = ['Your Vehicle', 'Vehicle Condition', 'Your Details'];
    return titles[this.currentStep() - 1];
  }

  get submitLabel(): string {
    return this.vehicleOfInterest
      ? 'Submit Part Exchange Request'
      : 'Submit Valuation Request';
  }
}
