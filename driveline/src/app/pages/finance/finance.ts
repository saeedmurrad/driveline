import { Component, signal, inject, PLATFORM_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Web3FormsEnquiryService } from '../../services/web3forms-enquiry.service';
import { submitEnquiryWithWeb3Fallback } from '../../utils/submit-enquiry';

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
        'Deposit required (typically 10%)',
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

  submitEnquiry() {
    const e = this.enquiry;
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
        onError: (msg) => this.enquiryError.set(msg),
        setSubmitting: (v) => this.enquirySubmitting.set(v),
      },
    );
  }
}
