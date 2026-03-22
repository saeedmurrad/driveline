import { Component, inject, signal, Input, computed } from '@angular/core';
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
export class SearchWidgetComponent {
  @Input() variant: 'hero' | 'page' = 'hero';
  @Input() initialCategory: string = 'car';

  private vehicleService = inject(VehicleService);
  private router = inject(Router);

  makes = MAKES;
  fuelTypes = FUEL_TYPES;
  transmissions = TRANSMISSIONS;
  doorOptions = DOOR_OPTIONS;

  isExpanded = signal(false);

  filters: SearchFilters = {
    category: this.initialCategory,
    make: '',
    model: '',
    transmission: '',
    fuelType: '',
    minPrice: undefined,
    maxPrice: undefined,
    minEngineSize: undefined,
    maxEngineSize: undefined,
  };

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

    this.vehicleService.setFilters(cleanFilters);

    const route = this.filters.category === 'van' ? '/vans' : '/cars';
    this.router.navigate([route]);
  }

  resetFilters() {
    this.filters = {
      category: 'car',
      make: '',
      model: '',
      transmission: '',
      fuelType: '',
    };
    this.vehicleService.clearFilters();
  }
}
