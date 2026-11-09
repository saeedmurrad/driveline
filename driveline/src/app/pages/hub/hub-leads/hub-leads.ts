import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { LeadsService } from '../../../services/leads.service';
import { VehicleService } from '../../../services/vehicle.service';
import {
  LEAD_STATUSES,
  LEAD_TYPE_LABELS,
  type Lead,
  type LeadStatus,
} from '../../../models/lead.model';

/**
 * DriveLine Hub: every website enquiry in one place, with status and notes.
 * Static (GitHub Pages) builds use this instead of the platform hub.
 */
@Component({
  selector: 'app-hub-leads',
  imports: [FormsModule, DatePipe, RouterLink],
  templateUrl: './hub-leads.html',
})
export class HubLeadsComponent implements OnInit, OnDestroy {
  protected readonly leadsService = inject(LeadsService);
  private readonly vehicles = inject(VehicleService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  readonly statuses = LEAD_STATUSES;

  // Sign-in form
  email = '';
  password = '';
  readonly signingIn = signal(false);
  readonly signInError = signal<string | null>(null);
  readonly resetSent = signal(false);

  // Lead list
  readonly filter = signal<'all' | LeadStatus>('new');
  readonly search = signal('');
  readonly selectedId = signal<string | null>(null);
  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);
  noteText = '';

  readonly staff = this.leadsService.staff;
  readonly leads = this.leadsService.leads;

  readonly counts = computed(() => {
    const c: Record<string, number> = { all: this.leads().length };
    for (const s of LEAD_STATUSES) c[s.key] = 0;
    for (const l of this.leads()) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  });

  readonly thisWeek = computed(() => {
    const since = Date.now() - 7 * 86_400_000;
    return this.leads().filter((l) => (l.createdAt?.getTime() ?? 0) >= since).length;
  });

  readonly visible = computed(() => {
    const f = this.filter();
    const q = this.search().trim().toLowerCase();
    return this.leads().filter((l) => {
      if (f !== 'all' && l.status !== f) return false;
      if (!q) return true;
      return [l.name, l.email, l.phone, l.vehicleLabel, l.subject, l.message]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  });

  readonly selected = computed(() => this.leads().find((l) => l.id === this.selectedId()) ?? null);

  constructor() {
    // Load leads once a staff member is signed in.
    effect(() => {
      if (this.staff()) void this.leadsService.startLeads();
    });
  }

  ngOnInit(): void {
    this.title.setTitle('Hub | DriveLine');
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    this.leadsService.watchAuth();
  }

  ngOnDestroy(): void {
    this.leadsService.stopLeads();
    this.meta.removeTag("name='robots'");
  }

  typeLabel(type: string): string {
    return LEAD_TYPE_LABELS[type] ?? type;
  }

  statusLabel(status: string): string {
    return LEAD_STATUSES.find((s) => s.key === status)?.label ?? status;
  }

  statusClass(status: string): string {
    return (
      {
        new: 'bg-rose-100 text-rose-700',
        contacted: 'bg-sky-100 text-sky-800',
        booked: 'bg-amber-100 text-amber-900',
        won: 'bg-emerald-100 text-emerald-800',
        lost: 'bg-stone-200 text-stone-600',
      }[status] ?? 'bg-stone-100 text-stone-700'
    );
  }

  /** Vehicle still on the site (for a link), else null. */
  vehicleLink(l: Lead): string | null {
    return l.vehicleId && this.vehicles.getVehicleById(l.vehicleId) ? `/vehicle/${l.vehicleId}` : null;
  }

  telHref(phone: string): string {
    return 'tel:' + phone.replace(/[^\d+]/g, '');
  }

  /** WhatsApp link for UK numbers (07… → 447…). */
  whatsappHref(phone: string): string | null {
    let d = phone.replace(/\D/g, '');
    if (d.startsWith('0')) d = '44' + d.slice(1);
    return d.length >= 10 ? `https://wa.me/${d}` : null;
  }

  mailHref(l: Lead): string {
    return `mailto:${l.email}?subject=${encodeURIComponent('Re: ' + l.subject)}`;
  }

  async signIn(): Promise<void> {
    this.signingIn.set(true);
    this.signInError.set(null);
    try {
      await this.leadsService.signIn(this.email, this.password);
      this.password = '';
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      this.signInError.set(
        code.includes('too-many-requests')
          ? 'Too many attempts. Wait a few minutes, or reset your password.'
          : code.includes('network')
            ? 'No connection. Check your internet and try again.'
            : 'Email or password is not right.',
      );
    } finally {
      this.signingIn.set(false);
    }
  }

  async resetPassword(): Promise<void> {
    if (!this.email.trim()) {
      this.signInError.set('Type your email first, then tap "Forgot password".');
      return;
    }
    try {
      await this.leadsService.sendPasswordReset(this.email);
    } catch {
      // Do not reveal whether the address has an account.
    }
    this.signInError.set(null);
    this.resetSent.set(true);
  }

  signOut(): void {
    this.selectedId.set(null);
    void this.leadsService.signOut();
  }

  select(l: Lead): void {
    this.selectedId.set(l.id);
    this.noteText = '';
    this.actionError.set(null);
  }

  async setStatus(l: Lead, status: LeadStatus): Promise<void> {
    if (l.status === status) return;
    await this.run(() => this.leadsService.setStatus(l.id, status));
  }

  async addNote(l: Lead): Promise<void> {
    const text = this.noteText;
    if (!text.trim()) return;
    await this.run(() => this.leadsService.addNote(l.id, text));
    if (!this.actionError()) this.noteText = '';
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.actionError.set(null);
    try {
      await fn();
    } catch {
      this.actionError.set('Could not save. Check your connection and try again.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Download the leads currently shown as a CSV file (opens in Excel / Sheets). */
  exportCsv(): void {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    const rows = [
      ['Received', 'Status', 'Type', 'Name', 'Phone', 'Email', 'Vehicle', 'Message', 'Notes'],
      ...this.visible().map((l) => [
        l.createdAt?.toISOString() ?? '',
        this.statusLabel(l.status),
        this.typeLabel(l.type),
        l.name,
        l.phone,
        l.email,
        l.vehicleLabel ?? '',
        l.message,
        l.notes.map((n) => `${n.at.slice(0, 10)} ${n.by}: ${n.text}`).join(' | '),
      ]),
    ];
    const blob = new Blob(['﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `driveline-enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}
