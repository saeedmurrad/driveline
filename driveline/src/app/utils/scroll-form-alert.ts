import { isPlatformBrowser } from '@angular/common';

/** After validation errors render, bring the alert into view (e.g. mobile, long forms). */
export function scrollFormAlertIntoView(
  platformId: object,
  elementId: string,
): void {
  if (!isPlatformBrowser(platformId)) {
    return;
  }
  setTimeout(() => {
    document.getElementById(elementId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, 0);
}
