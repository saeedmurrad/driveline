import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PartExchangeFormComponent } from '../../components/shared/part-exchange-form/part-exchange-form';

@Component({
  selector: 'app-sell-your-car',
  imports: [RouterLink, PartExchangeFormComponent],
  templateUrl: './sell-your-car.html',
  styleUrl: './sell-your-car.css',
})
export class SellYourCarComponent {}
