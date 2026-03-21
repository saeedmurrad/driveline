import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Vehicle } from '../../../models/vehicle.model';

@Component({
  selector: 'app-vehicle-card',
  imports: [RouterLink, CommonModule],
  templateUrl: './vehicle-card.html',
  styleUrl: './vehicle-card.css',
})
export class VehicleCardComponent {
  @Input({ required: true }) vehicle!: Vehicle;

  formatPrice(price: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  }

  formatMileage(mileage: number): string {
    return new Intl.NumberFormat('en-GB').format(mileage) + ' miles';
  }

  getFuelIcon(fuel: string): string {
    const icons: Record<string, string> = {
      Petrol: '⛽',
      Diesel: '🛢️',
      Hybrid: '🔋',
      Electric: '⚡',
      'Plug-in Hybrid': '🔌',
    };
    return icons[fuel] || '⛽';
  }
}
