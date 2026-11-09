/** Where a lead is in the sales process (shown in /hub). */
export type LeadStatus = 'new' | 'contacted' | 'booked' | 'won' | 'lost';

export const LEAD_STATUSES: { key: LeadStatus; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'booked', label: 'Booked in' },
  { key: 'won', label: 'Sold' },
  { key: 'lost', label: 'Lost' },
];

/** Website form that produced the lead. */
export const LEAD_TYPE_LABELS: Record<string, string> = {
  vehicle: 'Vehicle enquiry',
  'test-drive': 'Test drive',
  reserve: 'Reserve',
  video: 'Video viewing',
  finance: 'Finance',
  warranty: 'Warranty',
  'part-exchange': 'Part exchange',
  sourcing: 'Find me a car',
  contact: 'Contact form',
};

export interface LeadNote {
  /** ISO time */
  at: string;
  /** Staff email */
  by: string;
  text: string;
}

/** One website enquiry, stored in Firestore `leads/{id}`. */
export interface Lead {
  id: string;
  type: string;
  subject: string;
  name: string;
  email: string;
  phone: string;
  /** Full enquiry text as the customer sent it. */
  message: string;
  vehicleId?: string;
  vehicleLabel?: string;
  /** Page path the form was sent from. */
  page: string;
  createdAt: Date | null;
  status: LeadStatus;
  notes: LeadNote[];
  updatedAt?: Date | null;
  updatedBy?: string;
}

/** Fields the public website writes when a form is sent. */
export interface NewLead {
  type: string;
  subject: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  vehicleId?: string;
  vehicleLabel?: string;
  page: string;
}

const clip = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Pulls name, email and phone out of any form's payload (they use firstName/lastName,
 * name, or a nested `contact` object) so every lead looks the same in /hub.
 */
export function leadFromEnquiry(input: {
  type: string;
  subject: string;
  payload: Record<string, unknown>;
  vehicleId?: string;
  body: string;
  page: string;
}): NewLead {
  const p = input.payload ?? {};
  const c = (p['contact'] && typeof p['contact'] === 'object' ? p['contact'] : {}) as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    for (const src of [p, c]) {
      for (const k of keys) {
        const v = clip(src[k], 200);
        if (v) return v;
      }
    }
    return '';
  };
  const name =
    pick('name', 'fullName') || [pick('firstName'), pick('lastName')].filter(Boolean).join(' ');
  const lead: NewLead = {
    type: clip(input.type, 40) || 'contact',
    subject: clip(input.subject, 200),
    name: clip(name, 120),
    email: clip(pick('email'), 200),
    phone: clip(pick('phone', 'telephone', 'mobile'), 40),
    message: clip(input.body, 5000),
    page: clip(input.page, 200),
  };
  if (input.vehicleId) lead.vehicleId = clip(String(input.vehicleId), 40);
  const vehicleLine = clip(p['vehicleLine'], 200);
  if (vehicleLine) lead.vehicleLabel = vehicleLine;
  return lead;
}
