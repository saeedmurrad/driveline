import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HubAuthService } from '../../../services/hub-auth.service';

@Component({
  selector: 'app-hub-login',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div class="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-xl">
        <p class="text-xs uppercase tracking-widest text-sky-400 font-semibold">DivineBytes</p>
        <h1 class="text-2xl font-bold mt-1 mb-6">Hub</h1>
        <form (ngSubmit)="onSubmit()" class="space-y-4">
          <div>
            <label class="block text-sm text-slate-400 mb-1">Email</label>
            <input
              type="email"
              class="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2"
              [(ngModel)]="email"
              name="email"
              required
            />
          </div>
          <div>
            <label class="block text-sm text-slate-400 mb-1">Password</label>
            <input
              type="password"
              class="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2"
              [(ngModel)]="password"
              name="password"
              required
            />
          </div>
          @if (error()) {
            <p class="text-sm text-red-400">{{ error() }}</p>
          }
          <button
            type="submit"
            class="w-full rounded-lg bg-sky-600 hover:bg-sky-500 py-2.5 font-semibold"
            [disabled]="loading()"
          >
            {{ loading() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>
        <p class="text-xs text-slate-500 mt-6">
          Demo: admin@divinebytes.local / admin123 · driveline@divinebytes.local / driveline123 · demo@divinebytes.local / demo123
        </p>
        <a routerLink="/" class="block text-center text-sm text-slate-400 mt-4 hover:text-white">← Back to site</a>
      </div>
    </div>
  `,
})
export class HubLoginComponent {
  private readonly auth = inject(HubAuthService);
  private readonly router = inject(Router);

  email = 'demo@divinebytes.local';
  password = 'demo123';
  loading = signal(false);
  error = signal<string | null>(null);

  async onSubmit(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const ok = await this.auth.login(this.email, this.password);
    this.loading.set(false);
    if (ok) {
      await this.router.navigate(['/hub/dashboard']);
    } else {
      this.error.set('Invalid email or password');
    }
  }
}
