import { Component, inject, signal, Input, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { VehicleService } from '../../../services/vehicle.service';
import {
  MAKES,
  FUEL_TYPES,
  TRANSMISSIONS,
  DOOR_OPTIONS,
} from '../../../data/vehicles.data';
import { SearchFilters } from '../../../models/vehicle.model';

@Component({
  selector: 'app-search-widget',
  imports: [FormsModule, CommonModule],
  templateUrl: './search-widget.html',
  styleUrl: './search-widget.css',
})
export class SearchWidgetComponent implements OnInit {
  @Input() variant: 'hero' | 'page' = 'hero';
  @Input() initialCategory: string = 'car';

  private vehicleService = inject(VehicleService);
  private router = inject(Router);

  makes = MAKES;
  fuelTypes = FUEL_TYPES;
  transmissions = TRANSMISSIONS;
  doorOptions = DOOR_OPTIONS;

  isExpanded = signal(false);

  filters: SearchFilters = this.emptyFilters();

  categories = computed(() => {
    const { car, van } = this.vehicleService.inventoryCategoryCounts();
    return [
      { value: 'car' as const, label: `Cars (${car})` },
      { value: 'van' as const, label: `Vans (${van})` },
    ];
  });

  setCategory(cat: string) {
    this.filters.category = cat;
  }

  ngOnInit(): void {
    // Keep UI controls in sync with active service filters (used-cars page after route navigation).
    const current = this.vehicleService.getCurrentFilters();
    this.filters = {
      ...this.emptyFilters(),
      ...current,
      category: current.category || this.initialCategory,
    };
  }

  toggleExpanded() {
    this.isExpanded.update((v) => !v);
  }

  onSearch() {
    const cleanFilters: SearchFilters = {};
    if (this.filters.category) cleanFilters.category = this.filters.category;
    if (this.filters.make) cleanFilters.make = this.filters.make;
    if (this.filters.model) cleanFilters.model = this.filters.model;
    if (this.filters.transmission)
      cleanFilters.transmission = this.filters.transmission;
    if (this.filters.fuelType) cleanFilters.fuelType = this.filters.fuelType;
    if (this.filters.minPrice !== undefined)
      cleanFilters.minPrice = this.filters.minPrice;
    if (this.filters.maxPrice !== undefined)
      cleanFilters.maxPrice = this.filters.maxPrice;
    if (this.filters.minEngineSize !== undefined)
      cleanFilters.minEngineSize = this.filters.minEngineSize;
    if (this.filters.maxEngineSize !== undefined)
      cleanFilters.maxEngineSize = this.filters.maxEngineSize;
    if (this.filters.doors !== undefined && this.filters.doors !== null) {
      const d = Number(this.filters.doors);
      if (!Number.isNaN(d)) cleanFilters.doors = d;
    }

    this.vehicleService.setFilters(cleanFilters);

    const route = this.filters.category === 'van' ? '/vans' : '/cars';
    this.router.navigate([route], {
      queryParams: this.toQueryParams(cleanFilters),
    });
  }

  private toQueryParams(filters: SearchFilters): Record<string, string | number> {
    const qp: Record<string, string | number> = {};
    if (filters.make) qp['make'] = filters.make;
    if (filters.model) qp['model'] = filters.model;
    if (filters.transmission) qp['transmission'] = filters.transmission;
    if (filters.fuelType) qp['fuelType'] = filters.fuelType;
    if (filters.doors !== undefined) qp['doors'] = filters.doors;
    if (filters.minEngineSize !== undefined) qp['minEngineSize'] = filters.minEngineSize;
    if (filters.maxEngineSize !== undefined) qp['maxEngineSize'] = filters.maxEngineSize;
    if (filters.minPrice !== undefined) qp['minPrice'] = filters.minPrice;
    if (filters.maxPrice !== undefined) qp['maxPrice'] = filters.maxPrice;
    if (filters.minYear !== undefined) qp['minYear'] = filters.minYear;
    if (filters.maxYear !== undefined) qp['maxYear'] = filters.maxYear;
    if (filters.maxMileage !== undefined) qp['maxMileage'] = filters.maxMileage;
    return qp;
  }

  resetFilters() {
    this.filters = this.emptyFilters();
    this.vehicleService.clearFilters();
  }

  private emptyFilters(): SearchFilters {
    return {
      category: this.initialCategory || 'car',
      make: '',
      model: '',
      transmission: '',
      fuelType: '',
      minPrice: undefined,
      maxPrice: undefined,
      minEngineSize: undefined,
      maxEngineSize: undefined,
      doors: undefined,
    };
  }
}
