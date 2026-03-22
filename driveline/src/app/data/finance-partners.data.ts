/** Finance / credit partners (aligned with Fengate Car Sales “trusted partners” strip). */
export interface FinancePartner {
  name: string;
  /** Official or primary site — opens in new tab */
  url: string;
}

export const FINANCE_PARTNERS: FinancePartner[] = [
  { name: 'CarMoney', url: 'https://www.carmoney.co.uk/' },
  { name: 'Midland Credit Management', url: 'https://www.midlandcredit.co.uk/' },
  { name: 'MidlandCredit.co.uk', url: 'https://www.midlandcredit.co.uk/' },
  { name: 'VIZION FINANCE', url: 'https://www.vizionfinance.co.uk/' },
  { name: 'MotoNovo Finance', url: 'https://www.motonovo.co.uk/' },
  { name: 'CarFinance4You.co.uk', url: 'https://www.carfinance4you.co.uk/' },
];
