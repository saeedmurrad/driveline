import { NgClass } from '@angular/common';
import { Component, input } from '@angular/core';
import { FINANCE_PARTNERS } from '../../../data/finance-partners.data';

@Component({
  selector: 'app-trusted-partners',
  imports: [NgClass],
  templateUrl: './trusted-partners.html',
  styleUrl: './trusted-partners.css',
})
export class TrustedPartnersComponent {
  /** `dark` = footer on gray-900; `light` = contact page band */
  variant = input<'dark' | 'light'>('dark');
  partners = FINANCE_PARTNERS;
}
