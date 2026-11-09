import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GarageService } from '../../services/garage.service';
import { VehicleCardComponent } from '../../components/vehicles/vehicle-card/vehicle-card';

@Component({
  selector: 'app-saved',
  imports: [RouterLink, VehicleCardComponent],
  templateUrl: './saved.html',
})
export class SavedComponent {
  protected readonly garage = inject(GarageService);
}
