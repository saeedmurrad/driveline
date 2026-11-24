import { FindMeACarComponent } from '../../components/shared/find-me-a-car/find-me-a-car';
import { PhotoPendingComponent } from '../../components/shared/photo-pending/photo-pending';
import { FINANCE_DISCLAIMER_SHORT } from '../../utils/finance-display';
import { Component, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { VehicleService } from '../../services/vehicle.service';
import { Vehicle, SearchFilters } from '../../models/vehicle.model';
import { monthlyPaymentForVehicle } from '../../utils/finance-display';
import { VehicleCardComponent } from '../../components/vehicles/vehicle-card/vehicle-card';
import { SearchWidgetComponent } from '../../components/search/search-widget/search-widget';
import { AlertButtonComponent } from '../../components/shared/alert-button/alert-button';
import type { SavedSearch } from '../../services/alerts.service';

@Component({
  selector: 'app-vehicles',
  imports: [FormsModule, CommonModule, RouterLink, VehicleCardComponent, SearchWidgetComponent, FindMeACarComponent, PhotoPendingComponent, AlertButtonComponent],
  templateUrl: './vehicles.html',
  styleUrl: './vehicles.css',
})
export class VehiclesComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);
  vehicleService = inject(VehicleService);
  readonly financeNote = FINANCE_DISCLAIMER_SHORT;

  category: 'car' | 'van' = 'car';
  viewMode = signal<'grid' | 'list'>('grid');
  currentPage = signal(1);
  itemsPerPage = 9;

  sortOptions = [
    { label: 'Newest First', value: 'dateAdded-desc' },
    { label: 'Price: Low to High', value: 'price-asc' },
    { label: 'Price: High to Low', value: 'price-desc' },
    { label: 'Lowest Mileage', value: 'mileage-asc' },
    { label: 'Newest Year', value: 'year-desc' },
  ];

  selectedSort = 'dateAdded-desc';

  ngOnInit() {
    const routeCategory = this.route.snapshot.data['category'];
    if (routeCategory) {
      this.category = routeCategory;
    }
    const params = this.route.snapshot.queryParamMap;
    const filters: SearchFilters = {
      category: this.category,
      make: params.get('make') || undefined,
      model: params.get('model') || undefined,
      transmission: params.get('transmission') || undefined,
      fuelType: params.get('fuelType') || undefined,
      doors: this.toNumber(params.get('doors')),
      minEngineSize: this.toNumber(params.get('minEngineSize')),
      maxEngineSize: this.toNumber(params.get('maxEngineSize')),
      minPrice: this.toNumber(params.get('minPrice')),
      maxPrice: this.toNumber(params.get('maxPrice')),
      maxMonthly: this.toNumber(params.get('maxMonthly')),
      minYear: this.toNumber(params.get('minYear')),
      maxYear: this.toNumber(params.get('maxYear')),
      maxMileage: this.toNumber(params.get('maxMileage')),
      bodyType: params.get('bodyType') || undefined,
    };
    this.vehicleService.setFilters(filters);
  }

  private toNumber(v: string | null): number | undefined {
    if (v == null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }

  get pageTitle(): string {
    return this.category === 'van' ? 'Used Vans for Sale' : 'Used Cars for Sale';
  }

  get pageSubtitle(): string {
    return this.category === 'van'
      ? 'Quality commercial vehicles, ready for work'
      : 'Quality used cars, all inspected and warranted';
  }

  get allVehicles() {
    return this.vehicleService.filteredVehicles();
  }

  private alertSearchKey = '';
  private alertSearchValue: SavedSearch = {};

  /** The parts of the current search a new-arrival alert can follow (same object until the search changes). */
  get alertSearch(): SavedSearch {
    const f = this.vehicleService.getCurrentFilters();
    const next: SavedSearch = {
      category: this.category,
      make: f.make || undefined,
      bodyType: f.bodyType || undefined,
      fuelType: f.fuelType || undefined,
      transmission: f.transmission || undefined,
      maxPrice: f.maxPrice,
      maxMonthly: f.maxMonthly,
    };
    const key = JSON.stringify(next);
    if (key !== this.alertSearchKey) {
      this.alertSearchKey = key;
      this.alertSearchValue = next;
    }
    return this.alertSearchValue;
  }

  /** Monthly budget in force, shown next to the result count. */
  get monthlyBudget(): number | undefined {
    return this.vehicleService.getCurrentFilters().maxMonthly;
  }

  get totalCount(): number {
    return this.allVehicles.length;
  }

  get totalPages(): number {
    return Math.ceil(this.totalCount / this.itemsPerPage);
  }

  get paginatedVehicles() {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    return this.allVehicles.slice(start, start + this.itemsPerPage);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  onSortChange() {
    this.vehicleService.setSortBy(this.selectedSort);
    this.currentPage.set(1);
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage.set(page);
      if (isPlatformBrowser(this.platformId)) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  setViewMode(mode: 'grid' | 'list') {
    this.viewMode.set(mode);
  }

  formatPriceGBP(value: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  monthlyFinanceQuote(v: Vehicle): number | undefined {
    return monthlyPaymentForVehicle(v);
  }
}
