import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthSession } from '../../core/services/auth-session';
import {
  ComplexLocationPicker,
  type ComplexPoint
} from '../settings/complex-location-picker';

interface ApprovedSite {
  id: number;
  name: string;
  city: string;
  address: string;
}

interface City extends ComplexPoint {
  id: string;
  name: string;
}

interface CreatedComplex {
  complexId: number;
  fieldId: number;
}

function normalizeCity(value: string): string {
  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function minutesSinceMidnight(value: string): number {
  if (!/^\d{2}:\d{2}$/.test(value)) return NaN;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

@Component({
  selector: 'app-owner-complex-create',
  standalone: true,
  imports: [FormsModule, RouterLink, ComplexLocationPicker],
  templateUrl: './owner-complex-create.html'
})
export class OwnerComplexCreate {
  private readonly http = inject(HttpClient);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly sites = signal<ApprovedSite[]>([]);
  readonly loadingSites = signal(false);
  readonly sitesError = signal('');

  readonly loadingCities = signal(false);
  readonly citiesError = signal('');
  private readonly cityIndex = signal<{ city: City; key: string }[]>([]);
  readonly cityQuery = signal('');
  readonly chosenCity = signal<City | null>(null);
  readonly chosenPoint = signal<ComplexPoint | null>(null);

  readonly sending = signal(false);
  readonly error = signal('');
  readonly submitted = signal(false);

  readonly days = [
    { value: 'MONDAY', label: 'Lundi' },
    { value: 'TUESDAY', label: 'Mardi' },
    { value: 'WEDNESDAY', label: 'Mercredi' },
    { value: 'THURSDAY', label: 'Jeudi' },
    { value: 'FRIDAY', label: 'Vendredi' },
    { value: 'SATURDAY', label: 'Samedi' },
    { value: 'SUNDAY', label: 'Dimanche' }
  ];

  applicationId: number | null = null;
  newName = '';
  newAddress = '';
  newPhone = '';

  description = '';
  fieldName = '';
  sport = 'FOOTBALL';
  hourlyPrice: number | null = null;
  opens = '09:00';
  closes = '21:00';
  openDays = new Set<string>();
  photos: File[] = [];

  readonly cityResults = computed(() => {
    const query = normalizeCity(this.cityQuery());
    if (query.length < 2) return [];

    const exact: City[] = [];
    const other: City[] = [];

    for (const { city, key } of this.cityIndex()) {
      if (key === query) {
        exact.push(city);
      } else if (other.length < 50 && key.includes(query)) {
        other.push(city);
      }
    }

    return [...exact, ...other].slice(0, 50);
  });

  // La clé de ville permet de recréer la carte quand la sélection change.
  readonly mapCities = computed(() => {
    const city = this.chosenCity();
    return city ? [city] : [];
  });

  constructor() {
    this.loadSites();
  }

  loadSites(): void {
    if (this.loadingSites()) return;

    const token = this.session.token();
    if (!token) {
      this.session.expire();
      return;
    }

    this.loadingSites.set(true);
    this.sitesError.set('');

    this.http.get<ApprovedSite[]>('/api/v1/owner/complexes/approved-sites', {
      headers: { Authorization: `Bearer ${token}` }
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingSites.set(false))
    ).subscribe({
      next: sites => {
        this.sites.set(sites);
        this.selectSite(sites[0]?.id ?? null);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 401) {
          this.session.expire();
          return;
        }

        this.sitesError.set(err.status === 403
          ? 'Cette page est réservée aux propriétaires.'
          : 'Impossible de charger les emplacements disponibles.');
      }
    });
  }

  selectSite(id: number | null): void {
    this.applicationId = id;
    this.error.set('');

    if (id === null && this.cityIndex().length === 0) {
      this.loadCities();
    }
  }

  loadCities(): void {
    if (this.loadingCities()) return;

    this.loadingCities.set(true);
    this.citiesError.set('');

    this.http.get<City[]>('/data/morocco-cities.json').pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingCities.set(false))
    ).subscribe({
      next: cities => {
        this.cityIndex.set(cities.map(city => ({
          city,
          key: normalizeCity(city.name)
        })));

        if (cities.length === 0) {
          this.citiesError.set('Le catalogue des villes est vide.');
        }
      },
      error: () => {
        this.citiesError.set('Impossible de charger la liste des villes.');
      }
    });
  }

  searchCity(value: string): void {
    this.cityQuery.set(value);
    this.chosenCity.set(null);
    this.chosenPoint.set(null);
  }

  chooseCity(id: string): void {
    this.chosenCity.set(this.cityResults().find(city => city.id === id) ?? null);
    this.chosenPoint.set(null);
  }

  setDay(day: string, checked: boolean): void {
    if (checked) this.openDays.add(day);
    else this.openDays.delete(day);
  }

  choosePhotos(input: HTMLInputElement): void {
    this.error.set('');
    const selected = Array.from(input.files ?? []);

    if (selected.length > 4 ||
      selected.some(file => file.size === 0 || file.size > 2 * 1024 * 1024)) {
      input.value = '';
      this.photos = [];
      this.error.set('Choisissez 1 à 4 photos non vides de 2 Mo maximum chacune.');
      return;
    }

    this.photos = selected;
  }

  submit(): void {
    if (this.sending() || this.submitted()) return;

    const token = this.session.token();
    if (!token) {
      this.session.expire();
      return;
    }

    this.error.set('');

    const city = this.chosenCity();
    const point = this.chosenPoint();

    if (this.applicationId === null && (
      !this.newName.trim() ||
      !this.newAddress.trim() ||
      !this.newPhone.trim() ||
      !city ||
      !point
    )) {
      this.error.set('Complétez le nouvel emplacement et cliquez sur son entrée sur la carte.');
      return;
    }

    if (!this.description.trim() || !this.fieldName.trim() ||
      this.hourlyPrice === null || this.hourlyPrice <= 0) {
      this.error.set('Vérifiez la description, le nom du terrain et le tarif.');
      return;
    }

    if (!this.openDays.size) {
      this.error.set('Choisissez au moins un jour d’ouverture.');
      return;
    }

    const duration = minutesSinceMidnight(this.closes) - minutesSinceMidnight(this.opens);
    if (!Number.isFinite(duration) || duration < 60) {
      this.error.set('Prévoyez au moins une heure d’ouverture le même jour, par exemple 09:00 à 21:00.');
      return;
    }

    if (!this.photos.length) {
      this.error.set('Ajoutez au moins une photo du complexe.');
      return;
    }

    const newSite = this.applicationId === null && city && point
      ? {
        name: this.newName.trim(),
        city: city.name,
        address: this.newAddress.trim(),
        phone: this.newPhone.trim(),
        latitude: point.latitude,
        longitude: point.longitude
      }
      : null;

    const data = {
      applicationId: this.applicationId,
      newSite,
      description: this.description.trim(),
      fieldName: this.fieldName.trim(),
      sport: this.sport,
      hourlyPrice: this.hourlyPrice,
      opens: this.opens,
      closes: this.closes,
      openDays: [...this.openDays]
    };

    const body = new FormData();
    body.append('data', new Blob([JSON.stringify(data)], {
      type: 'application/json'
    }));

    for (const photo of this.photos) {
      body.append('photos', photo, photo.name);
    }

    this.sending.set(true);

    this.http.post<CreatedComplex>('/api/v1/owner/complexes', body, {
      headers: { Authorization: `Bearer ${token}` }
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.sending.set(false))
    ).subscribe({
      next: () => {
        this.submitted.set(true);
        void this.router.navigate(['/proprietaire'], { fragment: 'complexes' });
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 401) {
          this.session.expire();
          return;
        }

        if (err.status === 413) {
          this.error.set('Les photos dépassent la taille autorisée.');
          return;
        }

        const detail = err.error?.message ?? err.error?.detail;

        if ([400, 403, 409].includes(err.status) && typeof detail === 'string') {
          this.error.set(detail);
        } else {
          this.error.set(
            'La création n’a pas pu être confirmée. Consultez « Mes complexes » avant de réessayer.'
          );
        }
      }
    });
  }
}
