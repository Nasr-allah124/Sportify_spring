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
  readonly reviewingId = signal<number | null>(null);
  readonly rejectingId = signal<number | null>(null);
  readonly reason = signal('');
  readonly reviewError = signal('');
  readonly reviewMessage = signal('');

  startRejection(id: number): void {
    this.rejectingId.set(id);
    this.reason.set('');
    this.reviewError.set('');
    this.reviewMessage.set('');
  }

  cancelRejection(): void {
    this.rejectingId.set(null);
    this.reason.set('');
    this.reviewError.set('');
  }

  decide(id: number, decision: 'APPROVED' | 'REJECTED'): void {
    if (this.reviewingId() !== null) return;

    const token = this.session.token();
    if (!token) {
      this.session.expire();
      return;
    }

    this.reviewError.set('');
    this.reviewMessage.set('');

    const reason = decision === 'REJECTED' ? this.reason().trim() : null;

    if (decision === 'REJECTED' && !reason) {
      this.reviewError.set('Indiquez le motif du refus.');
      return;
    }

    this.reviewingId.set(id);

    this.api.review(id, decision, reason, token).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.reviewingId.set(null))
    ).subscribe({
      next: () => {
        this.applications.update(items => items.filter(item => item.id !== id));
        this.cancelRejection();
        this.reviewMessage.set(
          decision === 'APPROVED'
            ? `Demande #${id} acceptée. Le client est maintenant propriétaire.`
            : `Demande #${id} refusée. Le motif est disponible dans l’espace du client.`
        );
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 401) {
          this.session.expire();
          return;
        }

        if (err.status === 409) {
          this.cancelRejection();
          this.reviewError.set(
            'La demande ou le compte a changé. La liste a été actualisée.'
          );
          this.loadApplications();
          return;
        }

        this.reviewError.set(
          err.status === 403
            ? 'Le serveur a refusé cette décision. Vérifiez votre accès administrateur.'
            : err.status === 400
              ? 'Vérifiez la décision et le motif du refus.'
              : 'Impossible de confirmer la décision. Rechargez la liste avant de réessayer.'
        );
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
