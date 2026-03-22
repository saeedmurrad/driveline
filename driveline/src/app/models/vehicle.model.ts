export interface Vehicle {
  id: string;
  make: string;
  model: string;
  derivative: string;
  year: number;
  price: number;
  monthlyPrice?: number;
  mileage: number;
  transmission: 'Manual' | 'Automatic';
  fuelType: 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric' | 'Plug-in Hybrid';
  engineSize: number;
  doors: number;
  colour: string;
  bodyType: string;
  category: 'car' | 'van' | '4x4';
  description: string;
  features: string[];
  images: string[];
  thumbnailImage: string;
  registration?: string;
  previousOwners: number;
  motExpiry: string;
  serviceHistory: 'Full' | 'Part' | 'None';
  co2Emissions?: number;
  mpg?: number;
  bhp?: number;
  /** Top speed in mph (for print spec sheet) */
  topSpeedMph?: number;
  isNew?: boolean;
  isFeatured?: boolean;
  dateAdded: string;

  /** Canonical advert on fengatecarsales.co.uk (built from stock API slugs) */
  sourceListingUrl?: string;
  seats?: number;
  /** UK annual road tax (£), 12-month rate when provided by stock feed */
  taxRate12Month?: number;
  mpgUrban?: number;
  mpgExtraUrban?: number;
  heightMm?: number;
  lengthMm?: number;
  widthMm?: number;
  bootSpaceSeatsUpLitres?: number;
  bootSpaceSeatsDownLitres?: number;
  /** 0–60 mph time in seconds */
  acceleration0To60Seconds?: number;
}

export interface SearchFilters {
  category?: string;
  make?: string;
  model?: string;
  transmission?: string;
  fuelType?: string;
  doors?: number;
  minEngineSize?: number;
  maxEngineSize?: number;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  maxMileage?: number;
}

export interface SortOption {
  label: string;
  value: string;
}
