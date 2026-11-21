import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal
} from '@angular/core';

import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  finalize,
  Subscription,
  timeout,
  TimeoutError
} from 'rxjs';

import {
  AvailableSlot,
  CatalogApi,
  Field,
  ReservationResponse
} from '../../core/services/catalog-api';

import { AuthSession } from '../../core/services/auth-session';

@Component({
  selector: 'app-field-detail',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './field-detail.html'
})
export class FieldDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly catalogApi = inject(CatalogApi);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);

  private availabilitySubscription?: Subscription;

  // Informations du terrain
  readonly field = signal<Field | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  // Date et disponibilités
  readonly selectedDate = signal('');
  readonly slots = signal<AvailableSlot[]>([]);
  readonly loadingSlots = signal(false);
  readonly slotsError = signal('');

  // Date minimale dans le fuseau du complexe.
  readonly today = this.getTodayInCasablanca();

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (!Number.isInteger(id) || id <= 0) {
      this.error.set('Identifiant de terrain invalide.');
      this.loading.set(false);
      return;
    }

    this.catalogApi.getField(id).pipe(
      timeout(10_000),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (field) => {
        this.field.set(field);
      },

      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.error.set('Ce terrain est introuvable.');
        } else {
          this.error.set('Impossible de charger ce terrain.');
        }
      }
    });
  }

  onDateChange(date: string): void {
    this.selectedSlot.set(null);
this.bookingMessage.set('');
    // Arrêter la recherche précédente si la date change.
    this.availabilitySubscription?.unsubscribe();

    this.selectedDate.set(date);
    this.slots.set([]);
    this.slotsError.set('');

    if (!date) {
      return;
    }

    if (date < this.today) {
      this.slotsError.set('Choisissez une date à partir d’aujourd’hui.');
      return;
    }

    this.loadAvailability();
  }

  loadAvailability(): void {
    // Si l'utilisateur clique sur Réessayer,
    // arrêter toute requête précédente.
    this.availabilitySubscription?.unsubscribe();

    const field = this.field();
    const date = this.selectedDate();
    const token = this.session.token();

    if (!field || !date) {
      return;
    }

    if (!token) {
      this.session.expire();
      return;
    }

    this.loadingSlots.set(true);
    this.slotsError.set('');
    this.slots.set([]);

    this.availabilitySubscription = this.catalogApi
      .getAvailability(field.id, date, token)
      .pipe(
        timeout(10_000),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingSlots.set(false))
      )
      .subscribe({
        next: (slots) => {
          this.slots.set(slots);
        },

        error: (err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 401) {
            this.session.expire();
          } else if (err instanceof TimeoutError) {
            this.slotsError.set(
              'Le serveur met trop de temps à répondre. Réessayez.'
            );
          } else {
            this.slotsError.set(
              'Impossible de charger les disponibilités. Réessayez.'
            );
          }
        }
      });
  }
// Créneau sélectionné et état de la réservation
readonly selectedSlot = signal<AvailableSlot | null>(null);
readonly booking = signal(false);
readonly bookingMessage = signal('');
readonly confirmedReservation = signal<ReservationResponse | null>(null);
selectSlot(slot: AvailableSlot): void {
  if (this.booking() || this.bookingOutcomeUnknown()) {
    return;
  }

  this.selectedSlot.set(slot);
  this.bookingMessage.set('');
}

confirmReservation(): void {
  if (this.booking() || this.bookingOutcomeUnknown()) {
    return;
  }

  const field = this.field();
  const slot = this.selectedSlot();
  const token = this.session.token();

  if (!field || !slot) {
    this.bookingMessage.set('Choisissez un créneau.');
    return;
  }

  if (!token) {
    this.session.expire();
    return;
  }

  this.booking.set(true);
  this.bookingMessage.set('');
  this.confirmedReservation.set(null);

  this.catalogApi.createReservation(field.id, slot.startAt, token).pipe(
    timeout(15_000),
    takeUntilDestroyed(this.destroyRef),
    finalize(() => this.booking.set(false))
  ).subscribe({
    next: (reservation) => {
      this.confirmedReservation.set(reservation);
      this.selectedSlot.set(null);

      // Actualiser la liste : le créneau réservé disparaît.
      this.loadAvailability();
    },

    error: (err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        this.session.expire();
        return;
      }

      if (err instanceof HttpErrorResponse && err.status === 409) {
        this.selectedSlot.set(null);
        this.bookingMessage.set(
          'Ce créneau ou son tarif n’est plus disponible. Choisissez un autre créneau.'
        );

        this.loadAvailability();
        return;
      }

      if (
        err instanceof HttpErrorResponse &&
        [400, 403, 404].includes(err.status)
      ) {
        this.bookingMessage.set(
          'La demande a été refusée. Vérifiez votre compte et le terrain.'
        );
        return;
      }

      // Un timeout ou une erreur réseau ne dit pas si le serveur
      // a déjà enregistré la réservation.
      this.bookingOutcomeUnknown.set(true);
      this.bookingMessage.set(
        'La réponse du serveur n’a pas été reçue. Vérifiez si la réservation a été enregistrée avant de réessayer.'
      );
    }
  });
}
// Vrai si la réponse du serveur n'est pas arrivée :
// on ne sait pas encore si la réservation a été enregistrée.
readonly bookingOutcomeUnknown = signal(false);

  formatTime(value: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Africa/Casablanca',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(new Date(value));
  }

  private getTodayInCasablanca(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Casablanca',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());

    const year = parts.find(part => part.type === 'year')?.value;
    const month = parts.find(part => part.type === 'month')?.value;
    const day = parts.find(part => part.type === 'day')?.value;

    return `${year}-${month}-${day}`;
  }
}