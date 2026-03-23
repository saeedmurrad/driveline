import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DvlaVehicleService } from '../../../services/dvla-vehicle.service';
import { Web3FormsEnquiryService } from '../../../services/web3forms-enquiry.service';
import { PartExchangeFormComponent } from './part-exchange-form';

describe('PartExchangeFormComponent — DVLA lookup', () => {
  let fixture: ComponentFixture<PartExchangeFormComponent>;
  let component: PartExchangeFormComponent;
  let lookupSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    lookupSpy = vi.fn();

    await TestBed.configureTestingModule({
      imports: [PartExchangeFormComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: DvlaVehicleService,
          useValue: { lookupByRegistration: lookupSpy },
        },
        {
          provide: Web3FormsEnquiryService,
          useValue: {
            isConfigured: () => false,
            send: () => throwError(() => new Error('skip')),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PartExchangeFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('calls DVLA service with registration and applies response to the form', () => {
    lookupSpy.mockReturnValue(
      of({
        registrationNumber: 'AB12CDE',
        make: 'FORD',
        colour: 'blue',
        fuelType: 'PETROL',
        engineCapacity: 998,
        motExpiryDate: '2026-01-15',
        yearOfManufacture: 2015,
      }),
    );

    component.vehicle.registration = 'ab 12 cde';
    component.lookupVehicle();

    expect(lookupSpy).toHaveBeenCalledWith('ab 12 cde');
    expect(component.dvlaVehicleDetails()?.registrationNumber).toBe('AB12CDE');
    expect(component.vehicle.registration).toBe('AB12CDE');
    expect(component.vehicle.make).toBe('Ford');
    expect(component.vehicle.colour).toBe('blue');
    expect(component.vehicle.fuel).toBe('Petrol');
    expect(component.vehicle.derivative).toBe('');
    expect(component.vehicle.motExpiry).toBe('2026-01-15');
    expect(component.registrationLookupError()).toBeNull();
    expect(component.registrationLookupLoading()).toBe(false);
  });

  it('maps diesel fuel from DVLA', () => {
    lookupSpy.mockReturnValue(
      of({
        registrationNumber: 'CD56EFG',
        make: 'VOLKSWAGEN',
        fuelType: 'DIESEL',
      }),
    );
    component.vehicle.registration = 'CD56EFG';
    component.lookupVehicle();
    expect(component.vehicle.fuel).toBe('Diesel');
  });

  it('maps plug-in hybrid from DVLA string', () => {
    lookupSpy.mockReturnValue(
      of({
        registrationNumber: 'GH12HIJ',
        make: 'TOYOTA',
        fuelType: 'PLUGIN HYBRID ELECTRIC',
      }),
    );
    component.vehicle.registration = 'GH12HIJ';
    component.lookupVehicle();
    expect(component.vehicle.fuel).toBe('Plug-in Hybrid');
  });

  it('maps pure electric from DVLA string', () => {
    lookupSpy.mockReturnValue(
      of({
        registrationNumber: 'EV11ZZZ',
        make: 'TESLA',
        fuelType: 'ELECTRICITY',
      }),
    );
    component.vehicle.registration = 'EV11ZZZ';
    component.lookupVehicle();
    expect(component.vehicle.fuel).toBe('Electric');
  });

  it('sets registrationLookupError on lookup failure', () => {
    lookupSpy.mockReturnValue(
      throwError(() => new Error('No vehicle found for that registration.')),
    );
    component.vehicle.registration = 'ZZ99ZZZ';
    component.lookupVehicle();
    expect(component.registrationLookupError()).toBe(
      'No vehicle found for that registration.',
    );
    expect(component.dvlaVehicleDetails()).toBeNull();
    expect(component.registrationLookupLoading()).toBe(false);
  });

  it('does not call DVLA when not in browser', () => {
    TestBed.resetTestingModule();
    lookupSpy = vi.fn();
    TestBed.configureTestingModule({
      imports: [PartExchangeFormComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'server' },
        {
          provide: DvlaVehicleService,
          useValue: { lookupByRegistration: lookupSpy },
        },
        {
          provide: Web3FormsEnquiryService,
          useValue: { isConfigured: () => false, send: vi.fn() },
        },
      ],
    });
    const f = TestBed.createComponent(PartExchangeFormComponent);
    f.componentInstance.vehicle.registration = 'AB12CDE';
    f.componentInstance.lookupVehicle();
    expect(lookupSpy).not.toHaveBeenCalled();
  });
});
