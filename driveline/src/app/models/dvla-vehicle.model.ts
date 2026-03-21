/** DVLA Vehicle Enquiry API success payload (subset used in UI). */
export interface DvlaVehicleDetails {
  registrationNumber: string;
  taxStatus?: string;
  taxDueDate?: string;
  motStatus?: string;
  motExpiryDate?: string;
  make?: string;
  monthOfFirstRegistration?: string;
  yearOfManufacture?: number;
  engineCapacity?: number;
  co2Emissions?: number;
  fuelType?: string;
  colour?: string;
  typeApproval?: string;
  wheelplan?: string;
  euroStatus?: string;
  markedForExport?: boolean;
}

export interface DvlaErrorBody {
  errors?: Array<{
    status?: string;
    code?: string;
    title?: string;
    detail?: string;
  }>;
}
