import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { DvlaVehicleService } from './dvla-vehicle.service';

describe('DvlaVehicleService', () => {
  let service: DvlaVehicleService;
  let httpMock: HttpTestingController;

  const saved = {
    dvlaLookupUrl: environment.dvlaLookupUrl,
    dvlaApiKey: environment.dvlaApiKey,
  };

  beforeEach(() => {
    environment.dvlaLookupUrl = '/api/dvla-test';
    environment.dvlaApiKey = '';

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        DvlaVehicleService,
      ],
    });
    service = TestBed.inject(DvlaVehicleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    environment.dvlaLookupUrl = saved.dvlaLookupUrl;
    environment.dvlaApiKey = saved.dvlaApiKey;
  });

  describe('lookupByRegistration — validation', () => {
    it('rejects empty registration', async () => {
      await expect(
        firstValueFrom(service.lookupByRegistration('   ')),
      ).rejects.toThrow(/valid UK registration/);
    });

    it('rejects single-character registration', async () => {
      await expect(
        firstValueFrom(service.lookupByRegistration('A')),
      ).rejects.toThrow(/valid UK registration/);
    });

    it('rejects when dvlaLookupUrl is empty', async () => {
      environment.dvlaLookupUrl = '';
      await expect(
        firstValueFrom(service.lookupByRegistration('AB12CDE')),
      ).rejects.toThrow(/not configured/);
    });

    it('rejects when dvlaLookupUrl is whitespace only', async () => {
      environment.dvlaLookupUrl = '  \t  ';
      await expect(
        firstValueFrom(service.lookupByRegistration('AB12CDE')),
      ).rejects.toThrow(/not configured/);
    });
  });

  describe('lookupByRegistration — success', () => {
    it('normalises spaces and lower case in POST body', async () => {
      const promise = firstValueFrom(
        service.lookupByRegistration(' ab 12 cde '),
      );

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/dvla-test' &&
          r.method === 'POST' &&
          (r.body as { registrationNumber: string }).registrationNumber ===
            'AB12CDE',
      );
      expect(req.request.headers.get('x-api-key')).toBeNull();
      req.flush({
        registrationNumber: 'AB12CDE',
        make: 'FORD',
      });

      const res = await promise;
      expect(res.registrationNumber).toBe('AB12CDE');
      expect(res.make).toBe('FORD');
    });

    it('sends x-api-key when dvlaApiKey is set', async () => {
      environment.dvlaApiKey = ' test-key-123 ';

      const promise = firstValueFrom(
        service.lookupByRegistration('LL99ZZZ'),
      );

      const req = httpMock.expectOne('/api/dvla-test');
      expect(req.request.headers.get('x-api-key')).toBe('test-key-123');
      req.flush({ registrationNumber: 'LL99ZZZ' });

      await promise;
    });
  });

  describe('lookupByRegistration — error mapping', () => {
    it('maps DVLA errors[].detail', async () => {
      const promise = firstValueFrom(
        service.lookupByRegistration('XX00XXX'),
      );

      const req = httpMock.expectOne('/api/dvla-test');
      req.flush(
        {
          errors: [{ status: '400', title: 'Bad', detail: 'Vehicle not taxed' }],
        },
        { status: 400, statusText: 'Bad Request' },
      );

      await expect(promise).rejects.toThrow('Vehicle not taxed');
    });

    it('maps DVLA errors[].title when detail missing', async () => {
      const promise = firstValueFrom(
        service.lookupByRegistration('XX00XXX'),
      );

      const req = httpMock.expectOne('/api/dvla-test');
      req.flush(
        { errors: [{ title: 'Unauthorised' }] },
        { status: 401, statusText: 'Unauthorized' },
      );

      await expect(promise).rejects.toThrow('Unauthorised');
    });

    it('maps HTTP 404 to friendly message', async () => {
      const promise = firstValueFrom(
        service.lookupByRegistration('ZZ99ZZZ'),
      );

      const req = httpMock.expectOne('/api/dvla-test');
      req.flush({}, { status: 404, statusText: 'Not Found' });

      await expect(promise).rejects.toThrow(
        'No vehicle found for that registration.',
      );
    });

    it('maps status 0 to connection message', async () => {
      const promise = firstValueFrom(
        service.lookupByRegistration('AB12CDE'),
      );

      const req = httpMock.expectOne('/api/dvla-test');
      req.error(new ProgressEvent('error'));

      await expect(promise).rejects.toThrow(
        /Could not reach the registration service/,
      );
    });

    it('falls back to generic message for other failures', async () => {
      const promise = firstValueFrom(
        service.lookupByRegistration('AB12CDE'),
      );

      const req = httpMock.expectOne('/api/dvla-test');
      req.flush('upstream error', {
        status: 502,
        statusText: 'Bad Gateway',
      });

      await expect(promise).rejects.toThrow();
    });
  });
});
