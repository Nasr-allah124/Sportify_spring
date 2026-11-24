import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, Subscription, timeout, TimeoutError } from 'rxjs';
import { ComplexLocationMap } from '../settings/complex-location-picker';

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
  imports: [RouterLink, FormsModule, ComplexLocationMap],
  templateUrl: './field-detail.html'
})
export class FieldDetail implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly catalogApi = inject(CatalogApi);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);
  private availabilitySubscription?: Subscription;

  readonly field = signal<Field | null>(null);
  readonly photoPositions = signal<number[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly selectedDate = signal('');
  readonly slots = signal<AvailableSlot[]>([]);
  readonly selectedSlot = signal<AvailableSlot | null>(null);
  readonly loadingSlots = signal(false);
  readonly slotsError = signal('');

  readonly booking = signal(false);
  readonly bookingMessage = signal('');
  readonly bookingOutcomeUnknown = signal(false);
  readonly confirmedReservation = signal<ReservationResponse | null>(null);

  readonly today = this.getTodayInCasablanca();

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (!Number.isSafeInteger(id) || id <= 0) {
      this.error.set('Identifiant de terrain invalide.');
      this.loading.set(false);
      return;
    }

    this.catalogApi.getField(id).pipe(
      timeout(10_000),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: field => {
        this.field.set(field);

        this.http.get<number[]>('/api/v1/field-photos/' + field.id).pipe(
          takeUntilDestroyed(this.destroyRef)
        ).subscribe({
          next: positions => this.photoPositions.set(positions),
          error: () => this.photoPositions.set([])
        });
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(
          err.status === 404
            ? 'Ce terrain est introuvable.'
            : 'Impossible de charger ce terrain.'
        );
      }
    });
  }

  onDateChange(date: string): void {
    this.availabilitySubscription?.unsubscribe();
    this.selectedSlot.set(null);
    this.bookingMessage.set('');
    this.selectedDate.set(date);
    this.slots.set([]);
    this.slotsError.set('');

    if (!date) return;

    if (date < this.today) {
      this.slotsError.set('Choisissez une date à partir d’aujourd’hui.');
      return;
    }

    this.loadAvailability();
  }

  loadAvailability(): void {
    this.availabilitySubscription?.unsubscribe();

    const field = this.field();
    const date = this.selectedDate();
    if (!field || !date) return;

    const token = this.session.token();
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
        next: slots => this.slots.set(slots),
        error: (err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 401) {
            this.session.expire();
          } else if (err instanceof TimeoutError) {
            this.slotsError.set('Le serveur met trop de temps à répondre.');
          } else {
            this.slotsError.set('Impossible de charger les disponibilités.');
          }
        }
      });
  }

  selectSlot(slot: AvailableSlot): void {
    if (this.booking() || this.bookingOutcomeUnknown()) return;
    this.selectedSlot.set(slot);
    this.bookingMessage.set('');
  }

  confirmReservation(): void {
    if (this.booking() || this.bookingOutcomeUnknown()) return;

    const field = this.field();
    const slot = this.selectedSlot();
    if (!field || !slot) {
      this.bookingMessage.set('Choisissez un créneau.');
      return;
    }

    const token = this.session.token();
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
      next: reservation => {
        this.confirmedReservation.set(reservation);
        this.selectedSlot.set(null);
        this.loadAvailability();
      },
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse) {
          if (err.status === 401) {
            this.session.expire();
            return;
          }

          if (err.status === 409) {
            this.selectedSlot.set(null);
            this.bookingMessage.set(
              'Ce créneau ou son tarif a changé. Choisissez un autre créneau.'
            );
            this.loadAvailability();
            return;
          }

          if ([400, 403, 404].includes(err.status)) {
            this.bookingMessage.set(
              'La réservation a été refusée. Vérifiez votre compte et le terrain.'
            );
            return;
          }
        }

        this.bookingOutcomeUnknown.set(true);
        this.bookingMessage.set(
          'Réponse du serveur non reçue. Vérifiez « Mes réservations » avant de réessayer.'
        );
      }
    });
  }

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

