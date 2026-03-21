import {
  Component,
  signal,
  inject,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class HeaderComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);

  isMobileMenuOpen = signal(false);
  isDarkMode = signal(false);

  navItems = [
    { label: 'Cars', route: '/cars' },
    { label: 'Vans', route: '/vans' },
    { label: 'Finance', route: '/finance' },
    { label: 'Warranty', route: '/warranty' },
    { label: 'Sell Your Car', route: '/sell-your-car' },
    { label: 'Reviews', route: '/reviews' },
    { label: 'Contact', route: '/contact' },
  ];

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem('darkMode');
      if (stored === 'true') {
        this.isDarkMode.set(true);
        document.documentElement.classList.add('dark');
      }
    }
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu() {
    this.isMobileMenuOpen.set(false);
  }

  toggleDarkMode() {
    this.isDarkMode.update((v) => !v);
    if (isPlatformBrowser(this.platformId)) {
      if (this.isDarkMode()) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('darkMode', 'true');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('darkMode', 'false');
      }
    }
  }
}
