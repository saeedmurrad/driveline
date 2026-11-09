import { Component, Input } from '@angular/core';

/** Branded stand-in for a vehicle whose photos are still being taken. */
@Component({
  selector: 'app-photo-pending',
  host: { class: 'block h-full w-full' },
  template: `
    <div class="photo-pending relative flex h-full w-full flex-col items-center justify-center overflow-hidden text-center" [class.compact]="compact">
      <div class="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-rose-500/25 blur-3xl" aria-hidden="true"></div>
      <div class="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-orange-400/20 blur-3xl" aria-hidden="true"></div>
      <svg class="relative text-white/80" [class.h-14]="!compact" [class.w-14]="!compact" [class.h-7]="compact" [class.w-7]="compact" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 13l2-5a2 2 0 011.9-1.4h10.2A2 2 0 0119 8l2 5v4a1 1 0 01-1 1h-1a2 2 0 01-4 0H9a2 2 0 01-4 0H4a1 1 0 01-1-1v-4zm0 0h18M7 15h.01M17 15h.01"/>
      </svg>
      @if (!compact) {
        <p class="relative mt-3 text-[11px] font-bold uppercase tracking-[0.25em] text-rose-200">Photos coming soon</p>
        @if (title) {
          <p class="relative mt-1 px-4 text-lg font-bold text-white">{{ title }}</p>
        }
        <p class="relative mt-1 px-6 text-xs text-white/70">Being prepared on our forecourt. Ask us for a video walkaround.</p>
      }
    </div>
  `,
  styles: `
    .photo-pending {
      background:
        radial-gradient(120% 90% at 50% 0%, rgba(244, 63, 94, 0.18), transparent 60%),
        linear-gradient(160deg, #292524 0%, #1c1917 55%, #0c0a09 100%);
    }
  `,
})
export class PhotoPendingComponent {
  @Input() title = '';
  @Input() compact = false;
}
