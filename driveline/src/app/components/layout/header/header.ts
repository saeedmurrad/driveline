import {
  Component,
  signal,
  inject,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  computed,
  HostListener,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DealerContextService } from '../../../services/dealer-context.service';
import { GarageService } from '../../../services/garage.service';
import { SITE_THEMES, SiteTheme, ThemeService } from '../../../services/theme.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class HeaderComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private dealerContext = inject(DealerContextService);
  protected readonly garage = inject(GarageService);
  protected readonly themeService = inject(ThemeService);
  protected readonly themes = SITE_THEMES;
  /** Desktop theme picker popover */
  themeMenuOpen = signal(false);

  dealerName = computed(() => this.dealerContext.dealerName());

  isMobileMenuOpen = signal(false);
  isDarkMode = signal(false);
  /** Stronger shadow + border after scroll (desktop + mobile) */
  headerScrolled = signal(false);

  navItems = [
    { label: 'Cars', route: '/cars' },
    { label: 'Vans', route: '/vans' },
    { label: 'Finance', route: '/finance' },
    { label: 'Warranty', route: '/warranty' },
    { label: 'Sell Your Car', route: '/sell-your-car' },
    { label: 'Reviews', route: '/reviews' },
    { label: 'Contact', route: '/contact' },
  ];

  private scrollCleanup: (() => void) | null = null;

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem('darkMode');
      if (stored === 'true') {
        this.isDarkMode.set(true);
        document.documentElement.classList.add('dark');
      }

      const onScroll = () => {
        this.headerScrolled.set(window.scrollY > 12);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      this.scrollCleanup = () =>
        window.removeEventListener('scroll', onScroll);
    }
  }

  ngOnDestroy() {
    this.scrollCleanup?.();
    this.scrollCleanup = null;
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu() {
    this.isMobileMenuOpen.set(false);
  }

  toggleThemeMenu(event: Event) {
    event.stopPropagation();
    this.themeMenuOpen.update((v) => !v);
  }

  chooseTheme(theme: SiteTheme) {
    this.themeService.set(theme);
    this.themeMenuOpen.set(false);
  }

  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  closeThemeMenu() {
    this.themeMenuOpen.set(false);
  }

  toggleDarkMode() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const next = !this.isDarkMode();
    this.isDarkMode.set(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }
}
