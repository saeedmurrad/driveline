import { Component, signal, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-cookie-banner',
  imports: [RouterLink],
  templateUrl: './cookie-banner.html',
  styleUrl: './cookie-banner.css',
})
export class CookieBannerComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  isVisible = signal(false);

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const consent = localStorage.getItem('cookieConsent');
      if (!consent) {
        setTimeout(() => this.isVisible.set(true), 1500);
      }
    }
  }

  accept() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('cookieConsent', 'accepted');
    }
    this.isVisible.set(false);
  }

  reject() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('cookieConsent', 'rejected');
    }
    this.isVisible.set(false);
  }
}
