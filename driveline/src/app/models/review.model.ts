export interface Review {
  id: string;
  author: string;
  date: string;
  rating: number;
  title: string;
  body: string;
  source: 'Autotrader' | 'Google' | 'DriveLine';
  verified: boolean;
}
