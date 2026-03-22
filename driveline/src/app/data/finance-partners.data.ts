/** Finance / credit partners — official SVG logos (hosted locally from each lender’s site). */
export interface FinancePartner {
  id: string;
  name: string;
  /** Official or primary site — opens in new tab */
  url: string;
  /** Path under site root (`public/` → served at `/…` with base href) */
  logoSrc: string;
}

export const FINANCE_PARTNERS: FinancePartner[] = [
  {
    id: 'carmoney',
    name: 'CarMoney',
    url: 'https://www.carmoney.co.uk/',
    logoSrc: 'partners/carmoney.svg',
  },
  {
    id: 'midland-mgmt',
    name: 'Midland Credit Management',
    url: 'https://www.midlandcredit.co.uk/',
    logoSrc: 'partners/midland-credit.svg',
  },
  {
    id: 'midland-web',
    name: 'MidlandCredit.co.uk',
    url: 'https://www.midlandcredit.co.uk/',
    logoSrc: 'partners/midland-credit.svg',
  },
  {
    id: 'vizion',
    name: 'VIZION FINANCE',
    url: 'https://www.vizionfinance.co.uk/',
    logoSrc: 'partners/vizion-finance.svg',
  },
  {
    id: 'motonovo',
    name: 'MotoNovo Finance',
    url: 'https://www.motonovo.co.uk/',
    logoSrc: 'partners/motonovo.svg',
  },
  {
    id: 'carfinance4you',
    name: 'CarFinance4You.co.uk',
    url: 'https://www.carfinance4you.co.uk/',
    logoSrc: 'partners/carfinance4you.svg',
  },
];
