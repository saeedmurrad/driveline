/** URL slug for a make: "Mercedes-Benz" → "mercedes-benz", "Land Rover" → "land-rover". */
export function makeSlug(make: string): string {
  return make
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
