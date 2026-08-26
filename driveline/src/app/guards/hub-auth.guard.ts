import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { HubAuthService } from '../services/hub-auth.service';

const TOKEN_KEY = 'db_hub_token';

function hasStoredHubToken(platformId: object): boolean {
  if (!isPlatformBrowser(platformId)) return false;
  try {
    return !!localStorage.getItem(TOKEN_KEY);
  } catch {
    return false;
  }
}

export const hubAuthGuard: CanActivateFn = () => {
  const auth = inject(HubAuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  if (auth.token() || hasStoredHubToken(platformId)) {
    return true;
  }
  return router.createUrlTree(['/hub/login']);
};

export const hubGuestGuard: CanActivateFn = () => {
  const auth = inject(HubAuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  if (auth.token() || hasStoredHubToken(platformId)) {
    return router.createUrlTree(['/hub/dashboard']);
  }
  return true;
};
