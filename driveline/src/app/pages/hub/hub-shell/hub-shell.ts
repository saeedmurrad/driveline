import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HubAuthService } from '../../../services/hub-auth.service';

@Component({
  selector: 'app-hub-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="min-h-screen bg-slate-100 text-slate-900 flex">
      <aside class="w-56 shrink-0 bg-slate-950 text-slate-200 p-4 flex flex-col gap-1">
        <div class="mb-6 px-2">
          <p class="text-xs uppercase tracking-widest text-sky-400">DivineBytes</p>
          <p class="font-bold text-lg">Hub</p>
        </div>
        <a routerLink="/hub/dashboard" routerLinkActive="bg-slate-800" class="rounded-lg px-3 py-2 text-sm hover:bg-slate-800">Dashboard</a>
        <a routerLink="/hub/site" routerLinkActive="bg-slate-800" class="rounded-lg px-3 py-2 text-sm hover:bg-slate-800">Site settings</a>
        <a routerLink="/hub/stock" routerLinkActive="bg-slate-800" class="rounded-lg px-3 py-2 text-sm hover:bg-slate-800">Stock</a>
        <a routerLink="/hub/enquiries" routerLinkActive="bg-slate-800" class="rounded-lg px-3 py-2 text-sm hover:bg-slate-800">Enquiries</a>
        @if (auth.isPlatformAdmin()) {
          <a routerLink="/hub/dealers" routerLinkActive="bg-slate-800" class="rounded-lg px-3 py-2 text-sm hover:bg-slate-800">Dealers</a>
        }
        <div class="flex-1"></div>
        <button type="button" class="rounded-lg px-3 py-2 text-sm text-left hover:bg-slate-800" (click)="auth.logout()">Sign out</button>
      </aside>
      <main class="flex-1 p-6 overflow-auto">
        <router-outlet />
      </main>
    </div>
  `,
})
export class HubShellComponent {
  readonly auth = inject(HubAuthService);
}
