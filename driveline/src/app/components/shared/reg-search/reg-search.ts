import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

let nextId = 0;

/** "AB12 cde " → "AB12CDE"; null when it cannot be a UK registration. */
export function normaliseReg(raw: string | null | undefined): string | null {
  const reg = (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z0-9]{2,8}$/.test(reg) && /[A-Z]/.test(reg) && /\d/.test(reg) ? reg : null;
}

/**
 * Number-plate search box: type a registration and go to the free vehicle check
 * (/mot-check?reg=…). Used in the site-wide band, on the home pages and on the check page.
 */
@Component({
  selector: 'app-reg-search',
  // Plain DOM events instead of FormsModule: this box is on every page, so it must stay tiny.
  template: `
    <form class="reg-form" (submit)="$event.preventDefault(); submit()" novalidate>
      <label class="reg-plate">
        <span class="reg-flag" aria-hidden="true">UK</span>
        <span class="sr-only">Vehicle registration</span>
        <input
          #box
          name="reg"
          [value]="value"
          (input)="value = box.value; error.set('')"
          placeholder="ENTER REG"
          autocomplete="off"
          autocapitalize="characters"
          autocorrect="off"
          spellcheck="false"
          maxlength="9"
          [attr.aria-invalid]="error() ? 'true' : null"
          [attr.aria-describedby]="error() ? errId : null"
        />
      </label>
      <button type="submit" class="btn-primary reg-btn" [disabled]="busy">{{ busy ? 'Checking…' : buttonLabel }}</button>
    </form>
    @if (error()) {
      <p [id]="errId" class="reg-error" role="alert">{{ error() }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
    }
    .reg-form {
      display: flex;
      align-items: stretch;
      gap: 0.6rem;
    }
    /* UK number plate: yellow, black characters, blue band */
    .reg-plate {
      display: flex;
      flex: 1 1 auto;
      min-width: 0;
      height: 3.5rem;
      overflow: hidden;
      border-radius: 0.7rem;
      background: #ffd814;
      box-shadow: inset 0 0 0 2px #1a1a1a;
      cursor: text;
    }
    .reg-plate:focus-within {
      outline: 3px solid rgb(var(--dl-brand-rgb));
      outline-offset: 2px;
    }
    .reg-flag {
      display: flex;
      flex: 0 0 2.3rem;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 0.45rem;
      background: #1e3a8a;
      color: #fff;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .reg-plate input {
      flex: 1 1 auto;
      min-width: 0;
      width: 100%;
      border: 0;
      padding: 0 0.6rem;
      background: transparent;
      color: #111;
      font-family: var(--dl-font-display);
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-align: center;
      text-transform: uppercase;
      outline: none;
    }
    .reg-plate input::placeholder {
      color: rgb(17 17 17 / 0.42);
      letter-spacing: 0.06em;
    }
    .reg-btn {
      flex: 0 0 auto;
      justify-content: center;
      height: 3.5rem;
      padding-top: 0;
      padding-bottom: 0;
      white-space: nowrap;
    }
    .reg-btn:disabled {
      opacity: 0.7;
      cursor: progress;
    }
    .reg-error {
      margin-top: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: #b91c1c;
    }
    :host-context(.on-dark) .reg-error {
      color: #fecaca;
    }
    /* Narrow places (small phones, slim columns): the button drops under the plate */
    @container (max-width: 21rem) {
      .reg-form {
        flex-direction: column;
      }
    }
  `,
})
export class RegSearchComponent {
  private readonly router = inject(Router);

  @Input() value = '';
  @Input() buttonLabel = 'Check vehicle';
  @Input() busy = false;
  /** false on the check page itself, which reacts to (search) instead of a page change. */
  @Input() navigate = true;
  @Output() search = new EventEmitter<string>();

  readonly error = signal('');
  readonly errId = `reg-error-${nextId++}`;

  submit(): void {
    const reg = normaliseReg(this.value);
    if (!reg) {
      this.error.set('Enter a UK registration, for example AB12 CDE.');
      return;
    }
    this.error.set('');
    this.value = reg;
    this.search.emit(reg);
    if (this.navigate) this.router.navigate(['/mot-check'], { queryParams: { reg } });
  }
}
