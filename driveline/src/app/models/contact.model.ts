export interface ContactEnquiry {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  message: string;
  newsletterOptIn: boolean;
}

export interface FinanceEnquiry {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  vehicleOfInterest?: string;
  depositAmount?: number;
  loanTerm: number;
  message?: string;
  newsletterOptIn: boolean;
}

export interface WarrantyEnquiry {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  vehicleDetails?: string;
  message?: string;
  newsletterOptIn: boolean;
}

export interface SellCarEnquiry {
  registration: string;
  mileage: number;
  make: string;
  model: string;
  derivative: string;
  colour: string;
  fuel: string;
  gearbox: string;
  numberOfOwners: number;
  motExpiry: string;
  serviceHistory: string;
  condition: string;
  usedAsTaxi: boolean;
  transportedAnimals: boolean;
  usedBySmoker: boolean;
  additionalDetails?: string;
  images?: File[];
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  postcode?: string;
  newsletterOptIn: boolean;
}

export interface BusinessInfo {
  name: string;
  tagline: string;
  address: {
    line1: string;
    line2: string;
    town: string;
    county: string;
    postcode: string;
  };
  phone: string;
  mobile: string;
  email: string;
  openingHours: OpeningHour[];
  bankHolidayNote: string;
}

export interface OpeningHour {
  day: string;
  open: string;
  close: string;
}
