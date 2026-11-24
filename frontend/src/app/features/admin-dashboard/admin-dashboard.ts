import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthSession } from '../../core/services/auth-session';

interface Totals {
  accounts: number;
  clients: number;
  owners: number;
  complexes: number;
  fields: number;
  confirmed: number;
  cancelled: number;
  pending: number;
}

interface OwnerRow {
  id: number;
  name: string;
  complexes: number;
  fields: number;
  complexesBySport: string;
  confirmed: number;
  cancelled: number;
}

interface AccountRow {
  id: number;
  name: string;
  email: string;
  role: string;
  bookings: number;
}

interface Dashboard {
  totals: Totals;
  owners: OwnerRow[];
  accounts: AccountRow[];
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-dashboard.html'
})
export class AdminDashboard {
  private readonly http = inject(HttpClient);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);

  readonly data = signal<Dashboard | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly search = signal('');

  readonly accounts = computed(() => {
    const query = this.search().trim().toLowerCase();
    const accounts = this.data()?.accounts ?? [];

    return accounts.filter(account =>
      `${account.name} ${account.email} ${account.role}`
        .toLowerCase().includes(query)
    );
  });

  readonly cards = computed(() => {
    const t = this.data()?.totals;
    if (!t) return [];

    return [
      { label: 'Comptes inscrits', value: t.accounts },
      { label: 'Clients', value: t.clients },
      { label: 'Propriétaires', value: t.owners },
      { label: 'Complexes', value: t.complexes },
      { label: 'Terrains', value: t.fields },
      { label: 'Réservations confirmées', value: t.confirmed },
      { label: 'Réservations annulées', value: t.cancelled }
    ];
  });

  constructor() {
    this.load();
  }

  load(): void {
    if (this.loading()) return;

    const token = this.session.token();
    if (!token) {
      this.session.expire();
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.http.get<Dashboard>('/api/v1/admin/dashboard', {
      headers: { Authorization: `Bearer ${token}` }
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: dashboard => this.data.set(dashboard),
      error: (err: HttpErrorResponse) => {
        this.data.set(null);

        if (err.status === 401) {
          this.session.expire();
          return;
        }

        this.error.set(err.status === 403
          ? 'Cet espace est réservé aux administrateurs.'
          : 'Impossible de charger les statistiques de Sportify.');
      }
    });
  }
}
