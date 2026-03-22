import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/layout/header/header';
import { FooterComponent } from './components/layout/footer/footer';
import { CookieBannerComponent } from './components/layout/cookie-banner/cookie-banner';
import { TrustedPartnersComponent } from './components/layout/trusted-partners/trusted-partners';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    HeaderComponent,
    TrustedPartnersComponent,
    FooterComponent,
    CookieBannerComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
