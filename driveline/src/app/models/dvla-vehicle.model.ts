/** DVLA Vehicle Enquiry API success payload (the worker passes DVLA's JSON through unchanged). */
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
  monthOfFirstDvlaRegistration?: string;
  realDrivingEmissions?: string;
  revenueWeight?: number;
  dateOfLastV5CIssued?: string;
  /** Additional Rate of Tax end date (cars over £40k when new) */
  artEndDate?: string;
  automatedVehicle?: boolean;
}

export interface DvlaErrorBody {
  errors?: Array<{
    status?: string;
    code?: string;
    title?: string;
    detail?: string;
  }>;
}
