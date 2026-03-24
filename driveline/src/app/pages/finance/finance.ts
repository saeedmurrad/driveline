import { Component, signal, inject, PLATFORM_ID, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Web3FormsEnquiryService } from '../../services/web3forms-enquiry.service';
import { submitEnquiryWithWeb3Fallback } from '../../utils/submit-enquiry';
import { validateEnquiryFields } from '../../utils/enquiry-validation';
import { scrollFormAlertIntoView } from '../../utils/scroll-form-alert';
import {
  financeTermOptionsForPrice,
  FINANCE_ILLUSTRATIVE_PARAMS,
  FINANCE_DISCLAIMER_DETAIL,
} from '../../utils/finance-display';

@Component({
  selector: 'app-finance',
  imports: [RouterLink, FormsModule],
  templateUrl: './finance.html',
  styleUrl: './finance.css',
})
export class FinanceComponent {
  private platformId = inject(PLATFORM_ID);
  private web3 = inject(Web3FormsEnquiryService);
  enquirySent = signal(false);
  enquirySubmitting = signal(false);
  enquiryError = signal<string | null>(null);

  /** Illustrative HP calculator (36 / 48 / 60 mo, 0% dep, 9.9% APR rep.) */
  calcCashPrice = signal(12500);
  financeCalculatorRows = computed(() =>
    financeTermOptionsForPrice(Math.max(500, this.calcCashPrice())),
  );
  readonly financeCalcParams = FINANCE_ILLUSTRATIVE_PARAMS;
  readonly financeDisclaimerDetail = FINANCE_DISCLAIMER_DETAIL;

  enquiry = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    vehicleOfInterest: '',
    depositAmount: undefined as number | undefined,
    loanTerm: 36,
    message: '',
    newsletterOptIn: false,
  };

  financeTypes = [
    {
      title: 'Hire Purchase (HP)',
      icon: '🏦',
      color: 'blue',
      description:
        'Sometimes just referred to as HP, this is a loan secured against the vehicle itself. This is a great choice for people who want to spread out the cost of their car.',
      features: [
        'Deposit optional — listings show illustrative 0% deposit payments',
        'Fixed monthly repayments',
        'You own the car at the end',
        'No mileage restrictions',
        'Suitable for all credit histories',
      ],
      bestFor: 'Those who want to own the car at the end',
    },
    {
      title: 'Personal Contract Purchase (PCP)',
      icon: '🔄',
      color: 'green',
      description:
        'This is a good option for those who like to change their car every few years. You pay a deposit followed by monthly payments, then choose what to do at the end.',
      features: [
        'Lower monthly payments than HP',
        'Optional final balloon payment',
        'Return, buy or swap at the end',
        'Mileage limits apply',
        'Great for newer vehicles',
      ],
      bestFor: 'Those who like to change cars regularly',
    },
    {
      title: 'Personal Leasing',
      icon: '📋',
      color: 'purple',
      description:
        'Contract Hire deals are very much like PCP, however you won\'t have an option to buy the car outright at the end of the deal. Simply hand the car back.',
      features: [
        'Lowest monthly payments',
        'No depreciation risk',
        'Simply return at end of term',
        'Strict mileage allowances',
        'No ownership at end',
      ],
      bestFor: 'Those who always want a new car',
    },
  ];

  loanTerms = [12, 24, 36, 48, 60];

  formatCalcMonthly(value: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  onCalcPriceInput(raw: string | number): void {
    const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
    this.calcCashPrice.set(Number.isFinite(n) && n >= 500 ? Math.round(n) : 500);
  }

  submitEnquiry() {
    const e = this.enquiry;
    const validationError = validateEnquiryFields(e);
    if (validationError) {
      this.enquiryError.set(validationError);
      scrollFormAlertIntoView(this.platformId, 'finance-enquiry-alert');
      return;
    }
    const body = [
      `Name: ${e.firstName} ${e.lastName}`,
      `Email: ${e.email}`,
      `Phone: ${e.phone}`,
      `Vehicle of interest: ${e.vehicleOfInterest || '—'}`,
      `Preferred term (months): ${e.loanTerm}`,
      e.depositAmount != null ? `Deposit budget (£): ${e.depositAmount}` : null,
      `Newsletter opt-in: ${e.newsletterOptIn ? 'Yes' : 'No'}`,
      '',
      'Additional details:',
      e.message || '—',
    ]
      .filter((line) => line != null)
      .join('\n');
    const subject = 'Website enquiry — Finance';
    const fromName =
      `${e.firstName} ${e.lastName}`.trim() || 'Website visitor';
    submitEnquiryWithWeb3Fallback(
      this.web3,
      this.platformId,
      {
        subject,
        message: body,
        replyEmail: e.email,
        fromName,
      },
      subject,
      body,
      {
        onSuccess: () => {
          this.enquirySent.set(true);
          this.enquiryError.set(null);
        },
        onError: (msg) => {
          this.enquiryError.set(msg);
          scrollFormAlertIntoView(this.platformId, 'finance-enquiry-alert');
        },
        setSubmitting: (v) => this.enquirySubmitting.set(v),
      },
    );
  }
}
