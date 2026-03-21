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
