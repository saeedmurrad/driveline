import type { DealerRecord } from '../models/dealer.model';
import { BUSINESS_INFO, REVIEWS } from './reviews.data';

/** Static DriveLine tenant for GitHub Pages (no backend API). */
export const DRIVELINE_DEALER: DealerRecord = {
  id: 'dealer_driveline',
  slug: 'driveline',
  name: BUSINESS_INFO.name,
  tagline: BUSINESS_INFO.tagline,
  theme: 'driveline',
  colors: { primary: '#f43f5e', accent: '#fb923c' },
  customDomains: ['drivelinecarsales.co.uk', 'www.drivelinecarsales.co.uk'],
  subdomain: 'driveline',
  plan: 'pro',
  pageFlags: {
    finance: true,
    warranty: true,
    sellYourCar: true,
    reviews: true,
  },
  financeDisclaimer:
    'Finance subject to status. Figures are illustrative only.',
  business: BUSINESS_INFO,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

export { REVIEWS as DRIVELINE_REVIEWS };
