import { Component, computed, inject, input, signal } from '@angular/core';
import { PwaService } from '../../../services/pwa.service';

let nextId = 0;

/**
 * "Install the app" button. Shown only where installing is possible and not done yet:
 *  - Chrome, Edge, Android: opens the browser's own install prompt
 *  - iPhone / iPad: shows the two steps (Share, then Add to Home Screen)
 * Renders nothing in other browsers and inside the installed app.
 */
@Component({
  selector: 'app-install-app',
  template: `
    @if (visible()) {
      <div [class]="variant() === 'menu' ? 'ia ia-menu' : 'ia ia-footer'">
        <button
          type="button"
          class="ia-btn"
          (click)="onClick()"
          [attr.aria-expanded]="stepsMode() ? showSteps() : null"
          [attr.aria-controls]="stepsMode() ? stepsId : null"
        >
          <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14"/>
          </svg>
          <span>Install the DriveLine app</span>
        </button>
        @if (stepsMode() && showSteps()) {
          <ol [id]="stepsId" class="ia-steps">
            <li>Tap the <strong>Share</strong> button in your browser.</li>
            <li>Choose <strong>Add to Home Screen</strong>.</li>
          </ol>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    :host:empty {
      display: none;
    }
    .ia-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      min-height: 2.75rem;
      border-radius: 0.75rem;
      border: 1px solid;
      padding: 0 0.9rem;
      font-weight: 600;
      line-height: 1.2;
      text-align: left;
      transition: background-color 0.15s, border-color 0.15s;
    }
    .ia-steps {
      margin-top: 0.6rem;
      padding-left: 1.2rem;
      list-style: decimal;
      font-size: 0.8125rem;
      line-height: 1.5;
    }
    /* Footer (always on the dark footer background) */
    .ia-footer .ia-btn {
      border-color: rgb(var(--p-stone-700));
      background: rgb(var(--p-stone-800));
      color: #fff;
      font-size: 0.75rem;
    }
    .ia-footer .ia-btn:hover {
      border-color: rgb(var(--p-rose-400));
    }
    .ia-footer .ia-steps {
      color: rgb(var(--p-stone-300));
    }
    /* Phone menu */
    .ia-menu .ia-btn {
      width: 100%;
      min-height: 3rem;
      border-color: rgb(var(--p-stone-200));
      background: #fff;
      color: rgb(var(--p-stone-900));
      font-size: 0.875rem;
    }
    .ia-menu .ia-steps {
      color: rgb(var(--p-stone-700));
    }
    :host-context(html.dark) .ia-menu .ia-btn {
      border-color: rgb(var(--p-slate-600));
      background: rgb(var(--p-slate-900));
      color: #fff;
    }
    :host-context(html.dark) .ia-menu .ia-steps {
      color: rgb(var(--p-slate-200));
    }
  `,
})
export class InstallAppComponent {
  private readonly pwa = inject(PwaService);

  readonly variant = input<'footer' | 'menu'>('footer');
  readonly showSteps = signal(false);
  readonly stepsId = `install-steps-${nextId++}`;

  /** iPhone / iPad have no install prompt: the visitor follows two steps instead. */
  readonly stepsMode = computed(() => !this.pwa.canPrompt() && this.pwa.ios());
  readonly visible = computed(() => !this.pwa.standalone() && (this.pwa.canPrompt() || this.pwa.ios()));

  onClick(): void {
    if (this.pwa.canPrompt()) void this.pwa.install();
    else this.showSteps.update((open) => !open);
  }
}
