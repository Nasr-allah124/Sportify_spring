import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal
} from '@angular/core';

import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, timeout, TimeoutError } from 'rxjs';

import { AuthSession } from '../../core/services/auth-session';
import {
  AdminOwnerApi,
  OwnerApplication
} from '../../core/services/admin-owner-api';

@Component({
  selector: 'app-admin-owner-applications',
  standalone: true,
  templateUrl: './admin-owner-applications.html'
})
export class AdminOwnerApplications implements OnInit {
  private readonly api = inject(AdminOwnerApi);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);

  readonly applications = signal<OwnerApplication[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    this.loadApplications();
  }

  loadApplications(): void {
    if (this.loading()) {
      return;
    }

    const token = this.session.token();

    if (!token) {
      this.session.expire();
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.api.getPending(token).pipe(
      timeout(10_000),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (applications) => {
        this.applications.set(applications);
      },

      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 401) {
          this.session.expire();
        } else if (err instanceof HttpErrorResponse && err.status === 403) {
          this.error.set('Cette page est réservée aux administrateurs.');
        } else if (err instanceof TimeoutError) {
          this.error.set('Le serveur met trop de temps à répondre.');
        } else {
          this.error.set('Impossible de charger les demandes.');
        }
      }
    });
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Africa/Casablanca',
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  mapUrl(application: OwnerApplication): string | null {
    if (application.latitude === null || application.longitude === null) {
      return null;
    }

    const point = `${application.latitude},${application.longitude}`;

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point)}`;
  }
}