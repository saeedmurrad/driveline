import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { Unsubscribe } from 'firebase/firestore';
import type { Lead, LeadNote, LeadStatus, NewLead } from '../models/lead.model';
import { firebaseAuth, firestore } from './firebase-client';
import { STAFF_BROWSER_KEY } from './visit-stats.service';

/** One London day of visit counts (Firestore stats/{day}). */
export interface DayStats {
  day: string;
  views: number;
  visits: number;
  pages: Record<string, number>;
  cars: Record<string, number>;
  sources: Record<string, number>;
  devices: Record<string, number>;
}

export interface StaffUser {
  uid: string;
  email: string;
}

/**
 * Website enquiries stored in Firestore, and the /hub tools to work them.
 * Who may read and change leads is enforced by firestore.rules (staff/{uid} list).
 */
@Injectable({ providedIn: 'root' })
export class LeadsService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Signed-in staff member, `null` when signed out, `undefined` while checking. */
  readonly staff = signal<StaffUser | null | undefined>(undefined);
  /** Signed in with Firebase but not on the staff list. */
  readonly notStaff = signal(false);
  readonly leads = signal<Lead[]>([]);
  /** False until the first list of leads has arrived (show a placeholder, not "no enquiries"). */
  readonly leadsLoaded = signal(false);
  readonly leadsError = signal<string | null>(null);

  private unsubscribeLeads: Unsubscribe | null = null;
  private authWatching = false;

  // ---------- public website ----------

  /** Saves a website enquiry. Resolves with the new lead id. */
  async save(lead: NewLead): Promise<string> {
    const db = await firestore();
    const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
    const write = addDoc(collection(db, 'leads'), {
      ...lead,
      status: 'new',
      notes: [],
      createdAt: serverTimestamp(),
    });
    // Firestore waits indefinitely when offline; give up so the form can fall back to email.
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timed out saving enquiry')), 15000),
    );
    const ref = await Promise.race([write, timeout]);
    return ref.id;
  }

  // ---------- hub: auth ----------

  /** Starts following the Firebase sign-in state (call from /hub screens). */
  watchAuth(): void {
    if (!this.browser || this.authWatching) return;
    this.authWatching = true;
    void (async () => {
      const auth = await firebaseAuth();
      const { onAuthStateChanged } = await import('firebase/auth');
      onAuthStateChanged(auth, (user) => void this.onUser(user));
    })().catch(() => this.staff.set(null));
  }

  private async onUser(user: { uid: string; email: string | null } | null): Promise<void> {
    this.stopLeads();
    this.notStaff.set(false);
    if (!user) {
      this.staff.set(null);
      return;
    }
    const db = await firestore();
    const { doc, getDoc } = await import('firebase/firestore');
    try {
      const snap = await getDoc(doc(db, 'staff', user.uid));
      if (!snap.exists()) throw new Error('not staff');
      this.staff.set({ uid: user.uid, email: user.email ?? '' });
      // Do not count staff's own browsing in the visitor numbers.
      try {
        localStorage.setItem(STAFF_BROWSER_KEY, '1');
      } catch {
        // storage blocked
      }
    } catch {
      this.notStaff.set(true);
      this.staff.set(null);
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    const auth = await firebaseAuth();
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }

  async signOut(): Promise<void> {
    const auth = await firebaseAuth();
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
  }

  async sendPasswordReset(email: string): Promise<void> {
    const auth = await firebaseAuth();
    const { sendPasswordResetEmail } = await import('firebase/auth');
    await sendPasswordResetEmail(auth, email.trim());
  }

  // ---------- hub: leads ----------

  /** Live list of the newest 500 leads. */
  async startLeads(): Promise<void> {
    if (this.unsubscribeLeads) return;
    const db = await firestore();
    const { collection, limit, onSnapshot, orderBy, query } = await import('firebase/firestore');
    this.unsubscribeLeads = onSnapshot(
      query(collection(db, 'leads'), orderBy('createdAt', 'desc'), limit(500)),
      (snap) => {
        this.leadsError.set(null);
        this.leadsLoaded.set(true);
        this.leads.set(
          snap.docs.map((d) => {
            const x = d.data({ serverTimestamps: 'estimate' });
            return {
              id: d.id,
              type: x['type'] ?? '',
              subject: x['subject'] ?? '',
              name: x['name'] ?? '',
              email: x['email'] ?? '',
              phone: x['phone'] ?? '',
              message: x['message'] ?? '',
              vehicleId: x['vehicleId'],
              vehicleLabel: x['vehicleLabel'],
              page: x['page'] ?? '',
              createdAt: x['createdAt']?.toDate?.() ?? null,
              status: x['status'] ?? 'new',
              notes: Array.isArray(x['notes']) ? x['notes'] : [],
              updatedAt: x['updatedAt']?.toDate?.() ?? null,
              updatedBy: x['updatedBy'],
            } satisfies Lead;
          }),
        );
      },
      () => this.leadsError.set('Could not load enquiries. Check you are signed in as staff.'),
    );
  }

  stopLeads(): void {
    this.unsubscribeLeads?.();
    this.unsubscribeLeads = null;
    this.leads.set([]);
    this.leadsLoaded.set(false);
  }

  /** Visit counts for every London day from `fromDay` (YYYY-MM-DD) onwards. */
  async loadStats(fromDay: string): Promise<DayStats[]> {
    const db = await firestore();
    const { collection, documentId, getDocs, query, where } = await import('firebase/firestore');
    const snap = await getDocs(query(collection(db, 'stats'), where(documentId(), '>=', fromDay)));
    return snap.docs.map((d) => {
      const x = d.data();
      return {
        day: d.id,
        views: x['views'] ?? 0,
        visits: x['visits'] ?? 0,
        pages: x['pages'] ?? {},
        cars: x['cars'] ?? {},
        sources: x['sources'] ?? {},
        devices: x['devices'] ?? {},
      };
    });
  }

  async setStatus(id: string, status: LeadStatus): Promise<void> {
    const db = await firestore();
    const { doc, serverTimestamp, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'leads', id), {
      status,
      updatedAt: serverTimestamp(),
      updatedBy: this.staff()?.email ?? '',
    });
  }

  async addNote(id: string, text: string): Promise<void> {
    const clean = text.trim().slice(0, 2000);
    if (!clean) return;
    const db = await firestore();
    const { arrayUnion, doc, serverTimestamp, updateDoc } = await import('firebase/firestore');
    const note: LeadNote = { at: new Date().toISOString(), by: this.staff()?.email ?? '', text: clean };
    await updateDoc(doc(db, 'leads', id), {
      notes: arrayUnion(note),
      updatedAt: serverTimestamp(),
      updatedBy: note.by,
    });
  }
}
