import type { BusinessInfo } from './contact.model';
import type { Review } from './review.model';
import type { Vehicle } from './vehicle.model';

export type VehicleStatus = 'live' | 'reserved' | 'sold' | 'draft';
export type UserRole = 'platform_admin' | 'dealer_admin' | 'dealer_staff';

export interface DealerTheme {
  primary: string;
  accent: string;
}

export interface DealerPageFlags {
  finance: boolean;
  warranty: boolean;
  sellYourCar: boolean;
  reviews: boolean;
}

export interface DealerRecord {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  theme: 'driveline';
  colors: DealerTheme;
  logoUrl?: string;
  customDomains: string[];
  subdomain?: string;
  plan: 'starter' | 'growth' | 'pro';
  pageFlags: DealerPageFlags;
  financeDisclaimer: string;
  googleAnalyticsId?: string;
  /** Public-facing business block (footer, contact, etc.) */
  business: BusinessInfo;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformVehicle extends Vehicle {
  dealerId: string;
  status: VehicleStatus;
}

export type EnquiryType =
  | 'contact'
  | 'finance'
  | 'warranty'
  | 'vehicle'
  | 'part_exchange';

export interface EnquiryRecord {
  id: string;
  dealerId: string;
  type: EnquiryType;
  vehicleId?: string;
  subject: string;
  payload: Record<string, unknown>;
  createdAt: string;
  read: boolean;
}

export interface PlatformUser {
  uid: string;
  email: string;
  dealerId: string | null;
  role: UserRole;
  passwordHash?: string;
}

export interface DealerPublicProfile {
  dealer: DealerRecord;
  reviews: Review[];
}
