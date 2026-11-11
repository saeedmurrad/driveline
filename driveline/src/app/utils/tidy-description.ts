/**
 * Stock descriptions arrive from the dealer feed in capitals with "**" separators, e.g.
 * "**ULEZ COMPLIANT**DELIVERY AVAILABLE**TOP SPEC WITH 2 OWNERS…". Shouting text is hard to read,
 * so this turns it into short highlight chips plus normal sentence-case text, keeping
 * abbreviations (ULEZ, MOT, HPI…) and the car's own make/model words as written.
 */

const KEEP_UPPER = [
  'ULEZ', 'MOT', 'HPI', 'DAB', 'USB', 'LED', 'TDI', 'TSI', 'TFSI', 'BMW', 'VW', 'AMG', 'SRI', 'GTI', 'GTD', 'GT',
  'ABS', 'ESP', 'DPF', 'CD', 'MP3', 'AUX', 'AC', 'UK', 'HP', 'PCP', 'V5', 'V5C', '4X4', '4WD', 'AWD', 'BHP', 'MPG',
  'CO2', 'EV', 'PHEV', 'HEV', 'SUV', 'MPV', 'DSG', 'CVT', 'RS', 'ST', 'FSH', 'SE', 'DVLA', 'DVSA', 'TV', 'LCD', 'GPS',
  'ISOFIX', 'NOX', 'AdBlue', 'iPod', 'MINI', 'BMW', 'DS', 'MG', 'KIA', 'ID', 'VAT', 'PX', 'P/X', 'A/C', 'LWB', 'SWB',
];
const SPECIAL: Record<string, string> = {
  'car-play': 'CarPlay', carplay: 'CarPlay', 'apple car-play': 'Apple CarPlay', bluetooth: 'Bluetooth',
  'android auto': 'Android Auto', isofix: 'ISOFIX', adblue: 'AdBlue', 'sat-nav': 'sat nav', kia: 'Kia',
};

export interface TidyDescription {
  highlights: string[];
  text: string;
}

function mostlyUpper(s: string): boolean {
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (letters.length < 4) return false;
  return letters.replace(/[^A-Z]/g, '').length / letters.length > 0.6;
}

function sentenceCase(s: string, keep: Map<string, string>): string {
  let out = s.toLowerCase();
  for (const [from, to] of Object.entries(SPECIAL)) {
    out = out.replace(new RegExp(`\\b${from.replace(/[-/]/g, '\\$&')}\\b`, 'g'), to);
  }
  out = out.replace(/[A-Za-z0-9]+/g, (w) => keep.get(w.toLowerCase()) ?? w);
  // 77k, 2.0l → keep tidy units
  out = out.replace(/\b(\d+)l\b/g, '$1L');
  // Capital at the start and after full stops / exclamation marks
  out = out.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase());
  // Standalone "i"
  return out.replace(/\bi\b/g, 'I');
}

export function tidyDescription(raw: string | undefined, carWords = ''): TidyDescription {
  const source = (raw ?? '').trim();
  if (!source) return { highlights: [], text: '' };
  const keep = new Map<string, string>();
  for (const w of KEEP_UPPER) keep.set(w.toLowerCase(), w);
  for (const w of carWords.split(/\s+/)) if (/[A-Za-z]/.test(w) && w.length > 1) keep.set(w.toLowerCase(), w);

  const parts = source.split(/\*{2,}/).map((p) => p.trim().replace(/^[-–,\s]+|[-–,\s]+$/g, '')).filter(Boolean);
  const highlights: string[] = [];
  const body: string[] = [];
  for (const part of parts) {
    const clean = mostlyUpper(part) ? sentenceCase(part, keep) : part;
    // Short shouted phrases read best as chips ("ULEZ compliant", "Delivery available")
    if (parts.length > 1 && clean.length <= 42 && !/[.,]/.test(clean)) highlights.push(clean.charAt(0).toUpperCase() + clean.slice(1));
    else body.push(clean);
  }
  let text = body.join('. ').replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim();
  if (text && !/[.!?]$/.test(text)) text += '.';
  if (text) text = text.charAt(0).toUpperCase() + text.slice(1);
  return { highlights: highlights.slice(0, 6), text };
}
