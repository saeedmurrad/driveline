import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PartExchangeFormComponent } from '../../components/shared/part-exchange-form/part-exchange-form';
import { DealerContextService } from '../../services/dealer-context.service';

@Component({
  selector: 'app-sell-your-car',
  imports: [RouterLink, PartExchangeFormComponent],
  templateUrl: './sell-your-car.html',
  styleUrl: './sell-your-car.css',
})
export class SellYourCarComponent {
  private dealerContext = inject(DealerContextService);
  dealerName = this.dealerContext.dealerName;
}
