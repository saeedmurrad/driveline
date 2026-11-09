import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { VehicleService } from './vehicle.service';
import { VEHICLES } from '../data/vehicles.data';

describe('VehicleService stock status', () => {
  it('keeps sold cars out of search results and counts but lists them as recently sold', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    const service = TestBed.inject(VehicleService);
    const [first, second] = VEHICLES;
    // Drive the service with a small known stock list.
    (service as unknown as { allVehicles: { set(v: unknown): void } }).allVehicles.set([
      { ...first, status: 'sold', soldAt: '2026-11-08', images: first.images.length ? first.images : ['x.jpg'] },
      { ...second, status: 'reserved', previousPrice: second.price + 500, category: 'car' },
    ]);
    service.setFilters({ category: 'car' });

    expect(service.filteredVehicles().map((v) => v.id)).toEqual([second.id]);
    expect(service.recentlySold().map((v) => v.id)).toEqual([first.id]);
    expect(service.reducedVehicles().map((v) => v.id)).toEqual([second.id]);
    expect(service.inventoryCategoryCounts().car + service.inventoryCategoryCounts().van).toBe(1);
  });
});
