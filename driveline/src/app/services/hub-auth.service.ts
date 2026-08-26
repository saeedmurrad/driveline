import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { PlatformApiService, type HubUser } from './platform-api.service';

const TOKEN_KEY = 'db_hub_token';

@Injectable({ providedIn: 'root' })
export class HubAuthService {
  private readonly api = inject(PlatformApiService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  readonly user = signal<HubUser | null>(null);
  readonly token = signal<string | null>(null);
  readonly loading = signal(true);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading.set(false);
      return;
    }
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      this.token.set(stored);
      void this.refreshMe();
    } else {
      this.loading.set(false);
    }
  }

  async login(email: string, password: string): Promise<boolean> {
    try {
      const res = await this.api.hubLogin(email, password).toPromise();
      if (!res) return false;
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem(TOKEN_KEY, res.token);
      }
      this.token.set(res.token);
      this.user.set(res.user);
      return true;
    } catch {
      return false;
    }
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(TOKEN_KEY);
    }
    this.token.set(null);
    this.user.set(null);
    void this.router.navigate(['/hub/login']);
  }

  async refreshMe(): Promise<void> {
    const t = this.token();
    if (!t) {
      this.loading.set(false);
      return;
    }
    try {
      const res = await this.api.hubMe(t).toPromise();
      this.user.set(res?.user ?? null);
    } catch {
      this.logout();
    } finally {
      this.loading.set(false);
    }
  }

  isPlatformAdmin(): boolean {
    return this.user()?.role === 'platform_admin';
  }

  activeDealerId(): string | null {
    return this.user()?.dealerId ?? null;
  }
}
