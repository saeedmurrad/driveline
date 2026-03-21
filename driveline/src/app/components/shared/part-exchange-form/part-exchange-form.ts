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
import { openSalesEnquiryEmail } from '../../../utils/enquiry-mailto';
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

  vehicle = {
    registration: '',
    mileage: undefined as number | undefined,
    make: '',
    model: '',
    derivative: '',
    colour: '',
    fuel: '',
    gearbox: 'Manual',
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

  /** Maps DVLA response into the part-exchange form (model is not returned by DVLA). */
  private applyDvlaToForm(d: DvlaVehicleDetails): void {
    if (d.registrationNumber) {
      this.vehicle.registration = d.registrationNumber.toUpperCase();
    }
    this.vehicle.make = this.toTitleCase(d.make);
    this.vehicle.model = '';
    this.vehicle.colour = d.colour?.trim() || '';
    this.vehicle.fuel = this.mapDvlaFuelToForm(d.fuelType);

    const parts: string[] = [];
    if (d.engineCapacity != null && d.engineCapacity > 0) {
      parts.push(`${d.engineCapacity}cc`);
    }
    if (d.fuelType) {
      parts.push(this.toTitleCase(d.fuelType));
    }
    this.vehicle.derivative = parts.join(' · ');

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
    if (u.includes('ELECTRIC')) return 'Electric';
    if (u.includes('HYBRID') && (u.includes('PLUGIN') || u.includes('PHEV')))
      return 'Plug-in Hybrid';
    if (u.includes('HYBRID')) return 'Hybrid';
    const t = this.toTitleCase(fuel);
    return this.fuelOptions.includes(t) ? t : '';
  }

  nextStep() {
    this.currentStep.update((s) => Math.min(s + 1, 3));
  }

  prevStep() {
    this.currentStep.update((s) => Math.max(s - 1, 1));
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
    if (isPlatformBrowser(this.platformId)) {
      openSalesEnquiryEmail(subject, body);
    }
    this.isSubmitted.set(true);
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
