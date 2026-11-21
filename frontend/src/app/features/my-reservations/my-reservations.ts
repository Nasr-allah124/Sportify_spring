import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal
} from '@angular/core';

import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize, timeout, TimeoutError } from 'rxjs';

import { AuthSession } from '../../core/services/auth-session';
import {
  MyReservation,
  ReservationApi
} from '../../core/services/reservation-api';

@Component({
  selector: 'app-my-reservations',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './my-reservations.html'
})
export class MyReservations implements OnInit {
  private readonly api = inject(ReservationApi);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);

  readonly reservations = signal<MyReservation[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    this.loadReservations();
  }

  loadReservations(): void {
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

    this.api.getMine(token).pipe(
      timeout(10_000),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (reservations) => {
        this.reservations.set(reservations);
      },

      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 401) {
          this.session.expire();
        } else if (err instanceof TimeoutError) {
          this.error.set('Le serveur met trop de temps à répondre.');
        } else {
          this.error.set('Impossible de charger vos réservations.');
        }
      }
    });
  }
  readonly cancellingId = signal<number | null>(null);
readonly cancelMessage = signal('');
canCancel(reservation: MyReservation): boolean {
  const start = new Date(reservation.startAt).getTime();
  const twoHoursFromNow = Date.now() + 2 * 60 * 60 * 1000;

  return reservation.status === 'CONFIRMED'
    && Number.isFinite(start)
    && start > twoHoursFromNow;
}

cancelReservation(reservation: MyReservation): void {
  if (this.cancellingId() !== null || !this.canCancel(reservation)) {
    return;
  }

  const confirmed = window.confirm(
    'Voulez-vous vraiment annuler cette réservation ?'
  );

  if (!confirmed) {
    return;
  }

  const token = this.session.token();

  if (!token) {
    this.session.expire();
    return;
  }

  this.cancellingId.set(reservation.id);
  this.cancelMessage.set('');

  this.api.cancel(reservation.id, token).pipe(
    timeout(10_000),
    takeUntilDestroyed(this.destroyRef),
    finalize(() => this.cancellingId.set(null))
  ).subscribe({
    next: (updated) => {
      this.reservations.update(items =>
        items.map(item => item.id === updated.id ? updated : item)
      );

      this.cancelMessage.set('Votre réservation a été annulée.');
    },

    error: (err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        this.session.expire();
        return;
      }

      if (err instanceof HttpErrorResponse && err.status === 409) {
        this.cancelMessage.set(
          'Le délai d’annulation est dépassé.'
        );
        return;
      }

      if (err instanceof HttpErrorResponse && err.status === 404) {
        this.cancelMessage.set(
          'Cette réservation est introuvable.'
        );
        return;
      }

      this.cancelMessage.set(
        'La réponse du serveur n’a pas été reçue. Actualisez la liste pour vérifier le statut.'
      );

      // Recharge l'état enregistré par le serveur.
      this.loadReservations();
    }
  });
}


  formatDate(value: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Africa/Casablanca',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(new Date(value));
  }

  formatTime(value: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Africa/Casablanca',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(new Date(value));
  }
}