import { Component, inject } from '@angular/core';
import { PwaService } from '../../../services/pwa.service';

/**
 * A strip at the top of the page while there is no connection. It sits in the page itself
 * (it pushes the content down), so it can never cover a button or a form.
 */
@Component({
  selector: 'app-offline-notice',
  template: `
    @if (pwa.offline()) {
      <p
        role="status"
        class="flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2.5 text-center text-sm font-medium leading-snug text-amber-950 print:hidden dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
      >
        <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18M8.5 16.5a5 5 0 017 0M5 13a10 10 0 012.6-1.8m4-1.2A10 10 0 0119 13M2 9.5a15 15 0 013.3-2.3m4-1.5A15 15 0 0122 9.5M12 20h.01"/>
        </svg>
        <span>You’re offline. You can keep browsing; photos you haven’t opened yet and enquiry forms need a connection.</span>
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class OfflineNoticeComponent {
  readonly pwa = inject(PwaService);
}
