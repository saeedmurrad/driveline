# DriveLine - Project Brief

## Overview
DriveLine is a modern car dealership website, a UI clone of Fengate Car Sales (fengatecarsales.co.uk) built with Angular 21 and Tailwind CSS. The project provides a clean, professional interface for browsing and purchasing used cars, vans, and 4x4s.

## Business Context
- **Original Site reference**: https://www.fengatecarsales.co.uk/
- **Brand**: DriveLine
- **Live URL**: varies by deployment (e.g. **drivelinecarsales.co.uk** or **GitHub Pages**); print QR/listing link follows **current host + Angular base href**
- **Sales enquiries email** (testing): **saeedmurrad@gmail.com** via `SALES_EMAIL` — revert to **sales@drivelinecarsales.co.uk** for production
- **Business Type**: Family-owned used car dealership
- **Location**: Peterborough, Cambridgeshire (Vision House, 193 Fengate, PE1 5BH)
- **Established**: 2006

## Core Features
1. **Vehicle Listings** - Cars, Vans, 4x4s with filtering and search
2. **Vehicle Detail Pages** - Image gallery, specs, features, finance tab, enquiry form, **print details** (single-page A4 dealer-style sheet), part exchange modal
3. **Finance Options** - HP, PCP, Personal Leasing explanations
4. **Warranty Information** - In-house warranty program
5. **Sell Your Car** - Multi-step form (shared **part-exchange** component) with **UK registration lookup (DVLA API)**
6. **Customer Reviews** - Testimonials display
7. **Contact Page** - Business info, hours, Google Maps, contact form
8. **Legal Pages** - Privacy Policy, Cookie Policy, Disclaimer, Sitemap

## Design Goals
- Modern, clean UI with glassmorphism effects
- Blue (#2563eb) and Orange (#f97316) color palette
- Inter (body) and Poppins (headings) fonts
- Mobile-first responsive design
- Smooth page transitions
- GDPR-compliant cookie consent
- **Print**: One-page A4 vehicle sheet; header/footer readable without “Background graphics” (border + dark text on white)
