# DriveLine - Progress Tracker

## Completed Features ✅

### Infrastructure
- [x] Angular 21 project setup with SSR
- [x] Tailwind CSS v3 configuration
- [x] Routing with lazy loading
- [x] View transitions enabled
- [x] Google Fonts (Inter, Poppins)
- [x] **HttpClient** (`provideHttpClient(withFetch())`)
- [x] **Environments** + production **fileReplacements**
- [x] **Dev proxy** (`proxy.conf.cjs`) for DVLA API

### Layout Components
- [x] Header, Footer, Cookie banner, FAB (hidden in print via global CSS)

### Pages
- [x] Homepage, Cars/Vans listings, Vehicle detail
- [x] Finance, Warranty, Sell Your Car, Reviews, Contact, Legal

### Vehicle detail extras
- [x] **Print details** — single-page A4 dealer-style sheet, dynamic QR/URL from deployed origin + base href, bordered header/footer for readability
- [x] Part exchange modal with shared form

### Forms & contact
- [x] **`SALES_EMAIL`** single inbox for mailto + `BUSINESS_INFO` (currently **saeedmurrad@gmail.com** for testing)
- [x] **mailto enquiry flow** for Contact, Finance, Warranty, Vehicle enquiry, Part exchange / sell car submit

### Part exchange / DVLA
- [x] **DVLA Vehicle Enquiry API** integration (`DvlaVehicleService`)
- [x] UI: loading, errors, green DVLA summary card, map fuel/make/colour/MOT into form
- [x] Enquiry email includes DVLA snapshot when lookup used

### Data & Services
- [x] VehicleService (signals), mock data, interfaces
- [x] DVLA types + error mapping

### Styling
- [x] Print globals (`main` min-height reset, hide app shell in print)

## Pending / Future Enhancements 📋

### Backend / production
- [ ] **DVLA proxy** in production (serverless or API) + set **`environment.prod.ts`** `dvlaLookupUrl`
- [ ] Optional: replace **mailto** with real form POST / CRM / email API
- [ ] Connect to real inventory API / database
- [ ] Image upload for Sell Your Car (storage + backend)

### Features
- [ ] Real finance calculator
- [ ] User accounts / favorites
- [ ] Vehicle comparison
- [ ] Live chat widget

### Polish
- [ ] Replace placeholder images where desired
- [ ] SEO meta tags per page
- [ ] Analytics
- [ ] Accessibility audit

## Technical Debt
- Mailto URL length limits for very long part-exchange bodies (rare)
- Odd Node major version in dev — prefer LTS for CI/production
