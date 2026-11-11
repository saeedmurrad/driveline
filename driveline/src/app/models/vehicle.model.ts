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
  /** No real photos yet (dealer placeholders were filtered out). */
  photosPending?: boolean;
  /** 0–60 mph time in seconds */
  acceleration0To60Seconds?: number;

  /**
   * Not set (or 'live') = on sale. Reserved comes from the stock feed; sold cars stay
   * ~7 days. 'draft' is only used by the platform admin.
   */
  status?: 'live' | 'reserved' | 'sold' | 'draft';
  /** ISO date the car left stock (status 'sold'). */
  soldAt?: string;
  /** Published price before the latest reduction (only for real, recent reductions). */
  previousPrice?: number;
  /** ISO date the reduction was first published. */
  priceReducedAt?: string;
  /**
   * Per-photo category, one letter per entry in `images` (e = exterior, i = interior,
   * d = detail), written by scripts/tag-stock-photos.mjs. Kept as a string to keep the
   * baked-in stock data small.
   */
  imageTags?: string;
  /** Tiny blurred preview of the main photo (data URI), shown while it loads. */
  thumbBlur?: string;
  /** Main photo also exists as a 1600px WebP (X-1600.webp). */
  mainHiRes?: boolean;
  /** YouTube walkaround video from the stock feed, when the dealer adds one. */
  videoUrl?: string;
}

export type PhotoTag = 'exterior' | 'interior' | 'detail';

export const PHOTO_TAG_CODES: Record<string, PhotoTag> = { e: 'exterior', i: 'interior', d: 'detail' };

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
  bodyType?: string;
}

export interface SortOption {
  label: string;
  value: string;
}
