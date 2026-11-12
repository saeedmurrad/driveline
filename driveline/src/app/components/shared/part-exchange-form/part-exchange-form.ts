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
import { EnquirySubmitService } from '../../../services/enquiry-submit.service';
import { validateEnquiryFields } from '../../../utils/enquiry-validation';
import { scrollFormAlertIntoView } from '../../../utils/scroll-form-alert';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MotHistoryComponent } from '../../vehicles/mot-history/mot-history';
import { CommonModule } from '@angular/common';
import { finalize, catchError } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { summariseMot, type MotHistory, type MotSummary } from '../../../models/mot-history.model';
import { Vehicle } from '../../../models/vehicle.model';
import type { DvlaVehicleDetails } from '../../../models/dvla-vehicle.model';
import { DvlaVehicleService } from '../../../services/dvla-vehicle.service';

@Component({
  selector: 'app-part-exchange-form',
  imports: [RouterLink, FormsModule, CommonModule, MotHistoryComponent],
  templateUrl: './part-exchange-form.html',
  styleUrl: './part-exchange-form.css',
})
export class PartExchangeFormComponent {
  private platformId = inject(PLATFORM_ID);
  private dvlaVehicle = inject(DvlaVehicleService);
  /** Hide the Look up button when this build has no lookup service. */
  readonly lookupAvailable = this.dvlaVehicle.isAvailable();
  private enquirySubmit = inject(EnquirySubmitService);

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

  /** DVSA MOT history for the looked-up registration (null until found). */
  readonly motHistory = signal<MotHistory | null>(null);
  readonly motSummary = signal<MotSummary | null>(null);
  /** Full MOT history (every test) opened under the summary */
  readonly showFullMot = signal(false);

  lookupVehicle(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.registrationLookupError.set(null);
    this.showFullMot.set(false);
    this.step1FieldsError.set(null);
    this.dvlaVehicleDetails.set(null);
    this.motHistory.set(null);
    this.motSummary.set(null);
    this.registrationLookupLoading.set(true);

    // Ask DVLA and DVSA at the same time; use whatever answers.
    const reg = this.vehicle.registration;
    forkJoin({
      dvla: this.dvlaVehicle.lookupByRegistration(reg).pipe(catchError((e: unknown) => of(e instanceof Error ? e : new Error(String(e))))),
      mot: (this.dvlaVehicle.motHistory?.(reg) ?? of(null)).pipe(catchError(() => of(null))),
    })
      .pipe(finalize(() => this.registrationLookupLoading.set(false)))
      .subscribe(({ dvla, mot }) => {
        const dvlaOk = dvla && !(dvla instanceof Error) ? (dvla as DvlaVehicleDetails) : null;
        if (dvlaOk) {
          this.dvlaVehicleDetails.set(dvlaOk);
          this.applyDvlaToForm(dvlaOk);
        }
        if (mot) {
          this.motHistory.set(mot);
          this.motSummary.set(summariseMot(mot));
          this.applyMotToForm(mot);
        }
        if (!dvlaOk && !mot) {
          this.registrationLookupError.set(dvla instanceof Error ? dvla.message : 'Registration lookup failed.');
        }
      });
  }

  /** DVSA knows the model (DVLA does not); only fill what is still empty. */
  private applyMotToForm(m: MotHistory): void {
    if (m.registration) this.vehicle.registration = m.registration.toUpperCase();
    if (!this.vehicle.make && m.make) this.vehicle.make = this.toTitleCase(m.make);
    if (!this.vehicle.model && m.model) this.vehicle.model = this.toTitleCase(m.model);
    if (!this.vehicle.colour && m.colour) this.vehicle.colour = this.toTitleCase(m.colour);
    if (!this.vehicle.fuel && m.fuelType) this.vehicle.fuel = this.mapDvlaFuelToForm(m.fuelType);
    const s = summariseMot(m);
    if (!this.vehicle.motExpiry && s.validUntil) this.vehicle.motExpiry = s.validUntil;
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
    this.vehicle.colour = this.toTitleCase(d.colour);
    this.vehicle.fuel = this.mapDvlaFuelToForm(d.fuelType);

    if (d.motExpiryDate) {
      this.vehicle.motExpiry = d.motExpiryDate;
    }
  }

  /** MOT summary for the dealer's copy of the enquiry. */
  private motSummaryText(): string {
    const m = this.motHistory();
    const s = this.motSummary();
    if (!m || !s) return '';
    const latest = s.latest;
    return [
      '--- DVSA MOT history (at time of enquiry) ---',
      `Model: ${m.model || '—'}`,
      `Tests: ${s.tests}${s.firstTimePassRate != null ? `, passed first time ${s.firstTimePassRate}%` : ''}`,
      `MOT valid until: ${s.validUntil || '—'}`,
      s.lastMiles ? `Mileage at last MOT: ${s.lastMiles.miles.toLocaleString('en-GB')} (${s.lastMiles.date})` : '',
      s.mileageConsistent === false ? 'WARNING: recorded mileage went DOWN between MOTs' : '',
      latest?.advisories.length ? `Latest advisories: ${latest.advisories.map((a) => a.text).join('; ')}` : '',
      m.hasOutstandingRecall === 'Yes' ? 'Outstanding safety recall: YES' : '',
      '',
    ]
      .filter(Boolean)
      .join('\n');
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
        this.lookupAvailable
          ? `Please complete: ${missing.join(', ')}. Use Look up to pre-fill what DVLA and DVSA hold, then add the rest.`
          : `Please complete: ${missing.join(', ')}.`,
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
      this.motSummaryText(),
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
    void this.enquirySubmit.submit(
      {
        type: 'part_exchange',
        subject,
        payload: { vehicle: v, contact: c, dvla: this.dvlaVehicleDetails(), body },
        vehicleId: this.vehicleOfInterest?.id,
        mailtoSubject: subject,
        mailtoBody: body,
      },
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
