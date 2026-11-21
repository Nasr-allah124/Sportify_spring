import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { AuthSession } from '../../core/services/auth-session';
import {
  OwnerApplicationApi,
  OwnerApplicationResponse
} from '../../core/services/owner-application-api';
import {
  ComplexLocationPicker,
  ComplexPoint
} from './complex-location-picker';

interface MoroccanCity {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

function normalizeCityName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

@Component({
  selector: 'app-owner-application',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, ComplexLocationPicker],
  templateUrl: './owner-application.html'
})
export class OwnerApplication {
  private readonly api = inject(OwnerApplicationApi);
  private readonly http = inject(HttpClient);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);

  readonly application = signal<OwnerApplicationResponse | null>(null);
  readonly ready = signal(false);
  readonly loading = signal(false);
  readonly sending = signal(false);
  readonly editing = signal(false);
  readonly error = signal('');

  readonly cities = signal<MoroccanCity[]>([]);
  readonly citiesError = signal(false);
  readonly cityQuery = signal('');
  readonly selectedCity = signal<MoroccanCity | null>(null);
  readonly mapCities = computed((): MoroccanCity[] => {
    const city = this.selectedCity();
    return city ? [city] : [];
  });
  readonly selectedPoint = signal<ComplexPoint | null>(null);

  private readonly cityIndex = computed(() =>
    this.cities().map(city => ({
      city,
      searchName: normalizeCityName(city.name)
    }))
  );

  readonly cityOptions = computed(() => {
    const query = normalizeCityName(this.cityQuery());

    if (query.length < 2) {
      return [];
    }

    // Une ville appelée « Fès » apparaît avant les noms qui contiennent « fes ».
    const exactMatches: MoroccanCity[] = [];
    const otherMatches: MoroccanCity[] = [];
    const limit = 80;

    for (const { city, searchName } of this.cityIndex()) {
      if (searchName === query) {
        exactMatches.push(city);

        if (exactMatches.length === limit) {
          break;
        }
      } else if (otherMatches.length < limit && searchName.includes(query)) {
        otherMatches.push(city);
      }
    }

    return [...exactMatches, ...otherMatches].slice(0, limit);
  });

  readonly form = this.fb.group({
    complexName: [
      '',
      [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]
    ],
    city: [
      '',
      [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]
    ],
    address: [
      '',
      [Validators.required, Validators.maxLength(255), Validators.pattern(/\S/)]
    ],
    phone: [
      '',
      [Validators.required, Validators.maxLength(30), Validators.pattern(/\S/)]
    ],
    description: ['', Validators.maxLength(2000)]
  });

  constructor() {
    this.loadCities();
    this.load();
  }

  private loadCities(): void {
    this.http.get<MoroccanCity[]>('/data/morocco-cities.json')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: cities => this.cities.set(cities),
        error: () => this.citiesError.set(true)
      });
  }

  searchCity(value: string): void {
    this.cityQuery.set(value);
    this.chooseCity('');
  }

  chooseCity(id: string): void {
    const city = this.cityOptions().find(option => option.id === id) ?? null;

    this.selectedCity.set(city);
    this.form.controls.city.setValue(city?.name ?? '');
    this.selectedPoint.set(null);
  }

  load(): void {
    if (this.loading()) return;

    this.loading.set(true);
    this.ready.set(false);
    this.error.set('');

    this.api.latest().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: application => {
        this.application.set(application);
        this.ready.set(true);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 401) {
          this.session.expire();
          return;
        }

        this.error.set('Impossible de charger votre demande.');
      }
    });
  }

  submit(): void {
    if (this.sending() || !this.ready()) return;

    this.error.set('');
    this.form.markAllAsTouched();

    const city = this.selectedCity();
    if (!city) {
      this.error.set('Choisissez la ville du complexe dans la liste.');
      return;
    }

    if (this.form.invalid) {
      this.error.set('Vérifiez le nom du complexe, la ville, l’adresse et le téléphone.');
      return;
    }

    const point = this.selectedPoint();
    if (!point) {
      this.error.set('Sélectionnez l’entrée du complexe sur la carte.');
      return;
    }

    this.sending.set(true);

    this.api.submit({
      ...this.form.getRawValue(),
      city: city.name,
      latitude: point.latitude,
      longitude: point.longitude
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.sending.set(false))
    ).subscribe({
      next: application => {
        this.application.set(application);
        this.editing.set(false);
        this.form.reset();
        this.cityQuery.set('');
        this.selectedCity.set(null);
        this.selectedPoint.set(null);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 401) {
          this.session.expire();
        } else if (err.status === 409) {
          this.editing.set(false);
          this.load();
        } else if (err.status === 403) {
          this.error.set('Ce compte ne peut pas déposer de demande de propriétaire.');
        } else if (err.status === 400) {
          this.error.set('Vérifiez les informations du complexe.');
        } else {
          this.error.set('L’envoi a échoué. Vos informations sont conservées dans le formulaire.');
        }
      }
    });
  }
}
