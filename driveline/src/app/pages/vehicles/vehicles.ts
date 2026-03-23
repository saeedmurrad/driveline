import { Component, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { VehicleService } from '../../services/vehicle.service';
import { Vehicle } from '../../models/vehicle.model';
import { monthlyPaymentForVehicle } from '../../utils/finance-display';
import { VehicleCardComponent } from '../../components/vehicles/vehicle-card/vehicle-card';
import { SearchWidgetComponent } from '../../components/search/search-widget/search-widget';

@Component({
  selector: 'app-vehicles',
  imports: [FormsModule, CommonModule, RouterLink, VehicleCardComponent, SearchWidgetComponent],
  templateUrl: './vehicles.html',
  styleUrl: './vehicles.css',
})
export class VehiclesComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);
  vehicleService = inject(VehicleService);

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
    this.vehicleService.updateFilters({ category: this.category });
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
