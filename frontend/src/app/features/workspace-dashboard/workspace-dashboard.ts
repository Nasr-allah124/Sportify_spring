import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Subject, catchError, forkJoin, map, of, startWith, switchMap
} from 'rxjs';

import { AuthSession } from '../../core/services/auth-session';
import {OwnerFieldList} from '../owner/owner-field-create';

interface DayRow {
  day: string;
  confirmed: number;
  cancelled: number;
}

interface ComplexRow {
  id: number;
  name: string;
  city: string;
  owner: string;
  fields: number;
  confirmed: number;
  cancelled: number;
}

interface BookingRow {
  id: number;
  client: string;
  complex: string;
  field: string;
  createdAt: string;
  startAt: string;
  endAt: string;
  status: string;
}

interface Activity {
  from: string;
  through: string;
  days: DayRow[];
  complexes: ComplexRow[];
  bookings: BookingRow[];
  page: number;
  hasNext: boolean;
}

interface AdminSummary {
  totals: {
    accounts: number;
    clients: number;
    owners: number;
    pending: number;
  };
  owners: {
    id: number;
    name: string;
    complexes: number;
    fields: number;
    complexesBySport: string;
    confirmed: number;
    cancelled: number;
  }[];
  accounts: {
    id: number;
    name: string;
    email: string;
    role: string;
    bookings: number;
  }[];
}

@Component({
  selector: 'app-workspace-dashboard',
  standalone: true,
  imports: [RouterLink,OwnerFieldList],
  templateUrl: './workspace-dashboard.html',
  styleUrl: './workspace-dashboard.css'
})
export class WorkspaceDashboard {
  private readonly http = inject(HttpClient);
  private readonly session = inject(AuthSession);
  private readonly route = inject(ActivatedRoute);
  private readonly reload = new Subject<void>();

  readonly admin = this.route.snapshot.data['space'] === 'admin';
  readonly days = signal<7 | 30>(7);
  readonly page = signal(0);
  readonly busy = signal(true);
  readonly error = signal('');
  readonly activity = signal<Activity | null>(null);
  readonly summary = signal<AdminSummary | null>(null);
  readonly selectedDay = signal('');
  readonly query = signal('');

  readonly peak = computed(() => Math.max(
    1, ...(this.activity()?.days ?? []).map(d => d.confirmed + d.cancelled)
  ));

  readonly confirmed = computed(() =>
    (this.activity()?.days ?? []).reduce((sum, day) => sum + day.confirmed, 0)
  );

  readonly cancelled = computed(() =>
    (this.activity()?.days ?? []).reduce((sum, day) => sum + day.cancelled, 0)
  );

  readonly focused = computed(() =>
    this.activity()?.days.find(d => d.day === this.selectedDay())
  );

  readonly accounts = computed(() => {
    const text = this.query().trim().toLowerCase();
    return (this.summary()?.accounts ?? []).filter(a =>
      `${a.name} ${a.email} ${a.role}`.toLowerCase().includes(text)
    );
  });

  private readonly dateTime = new Intl.DateTimeFormat('fr-MA', {
    timeZone: 'Africa/Casablanca',
    dateStyle: 'short',
    timeStyle: 'short'
  });

  formatTime(instant: string): string {
    return this.dateTime.format(new Date(instant));
  }

  formatDay(day: string): string {
    const [, month, date] = day.split('-');
    return `${date}/${month}`;
  }

  constructor() {
    this.reload.pipe(
      startWith(undefined),
      switchMap(() => {
        this.busy.set(true);
        this.error.set('');

        const token = this.session.token();
        if (!token) {
          this.session.expire();
          return of(null);
        }

        const headers = { Authorization: `Bearer ${token}` };
        const path = this.admin ? 'admin' : 'owner';

        return forkJoin({
          activity: this.http.get<Activity>(`/api/v1/${path}/activity`, {
            headers,
            params: { days: this.days(), page: this.page() }
          }),
          summary: this.admin
            ? this.http.get<AdminSummary>('/api/v1/admin/dashboard', { headers })
            : of(null)
        }).pipe(
          map(result => ({ ...result, failed: false as const })),
          catchError((err: HttpErrorResponse) => {
            if (err.status === 401) this.session.expire();

            this.error.set(err.status === 403
              ? 'Ce compte n’a pas accès à cet espace.'
              : 'Impossible de charger les statistiques.');
            return of(null);
          })
        );
      }),
      takeUntilDestroyed()
    ).subscribe(result => {
      this.activity.set(result?.activity ?? null);
      this.summary.set(result?.summary ?? null);
      this.busy.set(false);
    });
  }

  refresh(): void {
    this.reload.next();
  }

  changePeriod(days: 7 | 30): void {
    if (this.days() === days) return;
    this.days.set(days);
    this.page.set(0);
    this.selectedDay.set('');
    this.refresh();
  }

  changePage(page: number): void {
    this.page.set(page);
    this.refresh();
  }
}
