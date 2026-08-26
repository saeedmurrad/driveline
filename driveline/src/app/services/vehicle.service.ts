import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Vehicle, SearchFilters } from '../models/vehicle.model';
import { PlatformApiService } from './platform-api.service';
import { DealerContextService } from './dealer-context.service';

@Injectable({
  providedIn: 'root',
})
export class VehicleService {
  private readonly api = inject(PlatformApiService);
  private readonly dealerContext = inject(DealerContextService);

  readonly stockLoading = signal(false);
  private allVehicles = signal<Vehicle[]>([]);
  private filters = signal<SearchFilters>({});
  private sortBy = signal<string>('dateAdded-desc');

  filteredVehicles = computed(() => {
    let result = [...this.allVehicles()];
    const f = this.filters();

    if (f.category) {
      result = result.filter((v) => v.category === f.category);
    }
    if (f.make) {
      result = result.filter(
        (v) => v.make.toLowerCase() === f.make!.toLowerCase(),
      );
    }
    if (f.model) {
      const q = f.model.toLowerCase().trim();
      result = result.filter((v) => {
        const haystack = [
          v.make,
          v.model,
          v.derivative,
          v.fuelType,
          v.transmission,
          v.bodyType,
          v.colour,
          v.registration || '',
          v.description || '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    }
    if (f.transmission) {
      result = result.filter(
        (v) => v.transmission.toLowerCase() === f.transmission!.toLowerCase(),
      );
    }
    if (f.fuelType) {
      result = result.filter(
        (v) => v.fuelType.toLowerCase() === f.fuelType!.toLowerCase(),
      );
    }
    if (f.doors) {
      result = result.filter((v) => v.doors === f.doors);
    }
    if (f.minEngineSize !== undefined) {
      result = result.filter((v) => v.engineSize >= f.minEngineSize!);
    }
    if (f.maxEngineSize !== undefined) {
      result = result.filter((v) => v.engineSize <= f.maxEngineSize!);
    }
    if (f.minPrice !== undefined) {
      result = result.filter((v) => v.price >= f.minPrice!);
    }
    if (f.maxPrice !== undefined) {
      result = result.filter((v) => v.price <= f.maxPrice!);
    }
    if (f.minYear !== undefined) {
      result = result.filter((v) => v.year >= f.minYear!);
    }
    if (f.maxYear !== undefined) {
      result = result.filter((v) => v.year <= f.maxYear!);
    }
    if (f.maxMileage !== undefined) {
      result = result.filter((v) => v.mileage <= f.maxMileage!);
    }

    const sort = this.sortBy();
    switch (sort) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'mileage-asc':
        result.sort((a, b) => a.mileage - b.mileage);
        break;
      case 'year-desc':
        result.sort((a, b) => b.year - a.year);
        break;
      case 'dateAdded-desc':
      default:
        result.sort(
          (a, b) =>
            new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime(),
        );
    }

    return result;
  });

  featuredVehicles = computed(() =>
    this.allVehicles()
      .filter((v) => v.isFeatured)
      .slice(0, 6),
  );

  inventoryCategoryCounts = computed(() => {
    const all = this.allVehicles();
    let car = 0;
    let van = 0;
    for (const v of all) {
      if (v.category === 'van') van++;
      else car++;
    }
    return { car, van };
  });

  constructor() {
    effect(() => {
      const dealer = this.dealerContext.dealer();
      if (dealer) void this.reloadFromPlatform();
    });
  }

  async reloadFromPlatform(): Promise<void> {
    this.stockLoading.set(true);
    try {
      const res = await firstValueFrom(this.api.fetchPublicVehicles());
      this.allVehicles.set(res.vehicles);
    } catch {
      this.allVehicles.set([]);
    } finally {
      this.stockLoading.set(false);
    }
  }

  setFilters(filters: SearchFilters) {
    this.filters.set(filters);
  }

  updateFilters(partial: Partial<SearchFilters>) {
    this.filters.update((prev) => ({ ...prev, ...partial }));
  }

  clearFilters() {
    this.filters.set({});
  }

  setSortBy(sort: string) {
    this.sortBy.set(sort);
  }

  getVehicleById(id: string): Vehicle | undefined {
    return this.allVehicles().find((v) => v.id === id);
  }

  getVehiclesByCategory(category: string): Vehicle[] {
    return this.allVehicles().filter((v) => v.category === category);
  }

  getCurrentFilters(): SearchFilters {
    return this.filters();
  }
}
