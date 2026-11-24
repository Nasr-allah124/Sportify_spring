import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AuthSession } from '../../core/services/auth-session';

interface OwnerComplex {
  id: number;
  name: string;
  hasHours: boolean;
}

const week = [
  ['MONDAY', 'Lundi'],
  ['TUESDAY', 'Mardi'],
  ['WEDNESDAY', 'Mercredi'],
  ['THURSDAY', 'Jeudi'],
  ['FRIDAY', 'Vendredi'],
  ['SATURDAY', 'Samedi'],
  ['SUNDAY', 'Dimanche']
];
interface EditHour {
  day: string;
  opening: string;
  closing: string;
}

interface FieldEditData {
  name: string;
  sport: string;
  price: number | null;
  capacity: number | null;
  description: string | null;
  hours: EditHour[];
}

@Component({
  selector: 'app-owner-field-editor',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="mt-5 rounded-2xl border border-line bg-page p-4 sm:p-6">
      <div class="flex items-center justify-between gap-3">
        <h4 class="text-lg font-semibold">Modifier le terrain</h4>

        <button type="button" class="text-sm underline"
                [disabled]="saving()" (click)="closed.emit()">
          Fermer
        </button>
      </div>

      @if (error()) {
        <p role="alert" class="mt-3 text-error">{{ error() }}</p>
      }

      @if (loading()) {
        <p role="status" class="mt-3">Chargement du terrain…</p>
      }

      @if (draft; as f) {
        <form #form="ngForm" (ngSubmit)="form.valid && save()" class="mt-4">
          <fieldset [disabled]="saving()" class="grid gap-4">
            <label class="grid gap-1">
              Nom du terrain
              <input name="name" [(ngModel)]="f.name" required maxlength="150">
            </label>

            <label class="grid gap-1">
              Sport
              <select name="sport" [(ngModel)]="f.sport" required>
                <option value="FOOTBALL">Football</option>
                <option value="PADEL">Padel</option>
                <option value="TENNIS">Tennis</option>
                <option value="BASKETBALL">Basket</option>
              </select>
            </label>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="grid gap-1">
                Tarif horaire (MAD)
                <input type="number" name="price" [(ngModel)]="f.price"
                       min="0.01" max="99999999.99" step="0.01" required>
              </label>

              <label class="grid gap-1">
                Capacité (facultatif)
                <input type="number" name="capacity" [(ngModel)]="f.capacity"
                       min="1" step="1">
              </label>
            </div>

            <label class="grid gap-1">
              Description
              <textarea name="description" [(ngModel)]="f.description"
                        rows="3" maxlength="2000"></textarea>
            </label>

            <fieldset class="grid gap-3">
              <legend class="mb-2 font-semibold">Horaires de ce terrain</legend>

              @for (d of days; track d.day) {
                <div class="flex flex-wrap items-center gap-3">
                  <label class="flex min-w-28 items-center gap-2">
                    <input type="checkbox" [name]="d.day" [(ngModel)]="d.enabled">
                    {{ d.label }}
                  </label>

                  @if (d.enabled) {
                    <input type="time" required [name]="d.day + 'Open'"
                           [attr.aria-label]="'Ouverture ' + d.label"
                           [(ngModel)]="d.opening">
                    <span>à</span>
                    <input type="time" required [name]="d.day + 'Close'"
                           [attr.aria-label]="'Fermeture ' + d.label"
                           [(ngModel)]="d.closing">
                  }
                </div>
              }
            </fieldset>

            <div class="flex flex-wrap gap-3">
              <button type="submit" class="button-primary"
                      [disabled]="form.invalid || saving()">
                {{ saving() ? 'Enregistrement…' : 'Enregistrer les modifications' }}
              </button>

              <button type="button" class="button-secondary"
                      (click)="closed.emit()">Annuler</button>
            </div>
          </fieldset>
        </form>
      }
    </div>
  `,
  styles: [`
    input:not([type=checkbox]), select, textarea {
      min-width: 0;
      border: 1px solid var(--color-line, #536359);
      border-radius: .75rem;
      padding: .6rem .8rem;
      background: var(--color-page, Canvas);
      color: inherit;
    }
  `]
})
export class OwnerFieldEditor {
  readonly fieldId = input.required<number>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  private readonly http = inject(HttpClient);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');

  draft: FieldEditData | null = null;

  readonly days = week.map(([day, label]) => ({
    day, label, enabled: false, opening: '09:00', closing: '18:00'
  }));

  ngOnInit(): void {
    const token = this.session.token();
    if (!token) {
      this.session.expire();
      return;
    }

    this.http.get<FieldEditData>(this.url(), {
      headers: { Authorization: 'Bearer ' + token }
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: data => {
        this.draft = data;

        for (const day of this.days) {
          const h = data.hours.find(item => item.day === day.day);
          if (h) {
            day.enabled = true;
            day.opening = h.opening.slice(0, 5);
            day.closing = h.closing.slice(0, 5);
          }
        }
      },
      error: (err: HttpErrorResponse) => this.failed(err)
    });
  }

  save(): void {
    const f = this.draft;
    if (!f || this.saving()) return;

    const token = this.session.token();
    if (!token) {
      this.session.expire();
      return;
    }

    const hours = this.days
      .filter(d => d.enabled)
      .map(({ day, opening, closing }) => ({ day, opening, closing }));

    const minutes = (time: string) =>
      Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

    if (hours.some(h => minutes(h.closing) - minutes(h.opening) < 60)) {
      this.error.set('Prévoyez au moins une heure d’ouverture chaque jour sélectionné.');
      return;
    }

    if (hours.length === 0 && f.hours.length > 0) {
      this.error.set('Gardez un jour ouvert ou utilisez « Mettre hors service ».');
      return;
    }

    this.error.set('');
    this.saving.set(true);

    this.http.put<void>(this.url(), { ...f, hours }, {
      headers: { Authorization: 'Bearer ' + token }
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: () => this.saved.emit(),
      error: (err: HttpErrorResponse) => this.failed(err)
    });
  }

  private url(): string {
    return '/api/v1/owner/fields/' + this.fieldId() + '/details';
  }

  private failed(err: HttpErrorResponse): void {
    if (err.status === 401) {
      this.session.expire();
      return;
    }

    if (err.status === 409) {
      this.error.set(
        'Une réservation confirmée tombe hors des nouveaux horaires. ' +
        'Consultez « Réservations reçues » avant de modifier cette plage.'
      );
      return;
    }

    this.error.set(
      err.status === 404
        ? 'Ce terrain est introuvable dans votre complexe.'
        : 'Impossible de traiter la demande. Vérifiez les valeurs puis réessayez.'
    );
  }
}

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 class="font-display text-4xl font-semibold">Ajouter un terrain</h1>

      @if (message()) {
        <p class="mt-4" role="status">{{ message() }}</p>
      }

      @if (error()) {
        <p class="mt-4 text-error" role="alert">{{ error() }}</p>
      }

      @if (complex(); as c) {
        <p class="my-4">Mon complexe · <strong>{{ c.name }}</strong></p>

        <form #form="ngForm" (ngSubmit)="form.valid && save()" class="w-full">
          <fieldset
            [disabled]="busy()"
            class="grid gap-4 rounded-2xl border border-line bg-surface p-6"
          >
            <label>
              Nom du terrain
              <input name="name" [(ngModel)]="name" required maxlength="150">
            </label>

            <label>
              Sport
              <select name="sport" [(ngModel)]="sport">
                <option value="FOOTBALL">Football</option>
                <option value="PADEL">Padel</option>
                <option value="TENNIS">Tennis</option>
                <option value="BASKETBALL">Basket</option>
              </select>
            </label>

            <label>
              Tarif horaire (MAD)
              <input
                type="number" name="price" [(ngModel)]="price"
                min="0.01" max="99999999.99" step="0.01" required
              >
            </label>

            <label>
              Capacité (facultatif)
              <input
                type="number" name="capacity" [(ngModel)]="capacity"
                min="1" step="1"
              >
            </label>

            <label>
              Description du terrain
              <textarea
                name="description" [(ngModel)]="description"
                maxlength="2000" rows="3"
              ></textarea>
            </label>

            <label>
              Photos du terrain (JPEG ou PNG, 1 Mo par photo)
              <input
                #files type="file" multiple accept="image/jpeg,image/png"
                (change)="photos = files.files"
              >
            </label>

            @if (!c.hasHours) {
              <fieldset class="grid gap-3">
                <legend class="font-semibold">
                  Horaires communs aux terrains du complexe
                </legend>

                @for (day of days; track day.day) {
                  <div class="flex flex-wrap items-center gap-3">
                    <label class="flex items-center gap-2">
                      <input
                        type="checkbox" [name]="day.day"
                        [(ngModel)]="day.enabled"
                      >
                      {{ day.label }}
                    </label>

                    @if (day.enabled) {
                      <input
                        type="time" required
                        [attr.aria-label]="'Ouverture ' + day.label"
                        [name]="day.day + 'Open'" [(ngModel)]="day.opening"
                      >
                      <input
                        type="time" required
                        [attr.aria-label]="'Fermeture ' + day.label"
                        [name]="day.day + 'Close'" [(ngModel)]="day.closing"
                      >
                    }
                  </div>
                }
              </fieldset>
            }

            <button
              type="submit" class="button-primary"
              [disabled]="form.invalid || busy()"
            >
              {{ busy() ? 'Enregistrement…' : 'Ajouter ce terrain' }}
            </button>
          </fieldset>
        </form>
      } @else if (!error()) {
        <p role="status" class="mt-4">Chargement du complexe…</p>
      }
    </main>
  `,
  styles: [`
    label { display: grid; gap: .35rem; }
    input:not([type=checkbox]), select, textarea {
      border: 1px solid currentColor;
      border-radius: .6rem;
      padding: .6rem;
      color: inherit;
      background: var(--color-page, Canvas);
    }
  `]
})
export class OwnerFieldCreate {
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('files');
  private readonly http = inject(HttpClient);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);

  readonly complex = signal<OwnerComplex | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');

  name = '';
  sport = 'FOOTBALL';
  price: number | null = null;
  capacity: number | null = null;
  description = '';
  photos: FileList | null = null;

  readonly days = week.map(([day, label]) => ({
    day,
    label,
    enabled: false,
    opening: '09:00',
    closing: '18:00'
  }));

  constructor() {
    const token = this.session.token();

    if (!token) {
      this.session.expire();
      return;
    }

    this.http.get<OwnerComplex>('/api/v1/owner/fields', {
      headers: { Authorization: 'Bearer ' + token }
    }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: complex => this.complex.set(complex),
      error: err => this.failed(err)
    });
  }

  save(): void {
    const complex = this.complex();
    if (!complex || this.busy()) return;

    const token = this.session.token();
    if (!token) {
      this.session.expire();
      return;
    }

    this.error.set('');
    this.message.set('');

    const selectedHours = complex.hasHours
      ? []
      : this.days.filter(day => day.enabled);

    const minutes = (value: string) =>
      Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

    if (!complex.hasHours && (
      selectedHours.length === 0 ||
      selectedHours.some(day => minutes(day.closing) - minutes(day.opening) < 60)
    )) {
      this.error.set(
        'Choisissez au moins un jour avec une heure d’ouverture minimum le même jour.'
      );
      return;
    }

    const photos = Array.from(this.photos ?? []);

    if (photos.length > 6 || photos.some(photo => photo.size > 1024 * 1024)) {
      this.error.set('Choisissez jusqu’à six photos de 1 Mo maximum chacune.');
      return;
    }

    const data = new FormData();

    data.append('field', new Blob([JSON.stringify({
      name: this.name,
      sport: this.sport,
      price: this.price,
      capacity: this.capacity,
      description: this.description,
      hours: selectedHours.map(({ day, opening, closing }) => ({
        day, opening, closing
      }))
    })], { type: 'application/json' }));

    for (const photo of photos) {
      data.append('photos', photo);
    }

    this.busy.set(true);

    this.http.post('/api/v1/owner/fields', data, {
      headers: { Authorization: 'Bearer ' + token }
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.busy.set(false))
    ).subscribe({
      next: () => {
        this.message.set(`Terrain « ${this.name} » ajouté à ${complex.name}.`);
        this.name = '';
        this.price = null;
        this.capacity = null;
        this.description = '';
        this.photos = null;

        const input = this.fileInput();
        if (input) input.nativeElement.value = '';

        this.complex.set({ ...complex, hasHours: true });
      },
      error: err => this.failed(err)
    });
  }

  private failed(err: HttpErrorResponse): void {
    if (err.status === 401) {
      this.session.expire();
      return;
    }

    switch (err.status) {
      case 403:
        this.error.set('Aucun complexe accessible pour ce compte propriétaire.');
        break;
      case 409:
        this.error.set('Les horaires ont changé. Rechargez le formulaire.');
        break;
      case 413:
        this.error.set('Les photos dépassent la taille autorisée.');
        break;
      default:
        this.error.set('Vérifiez les informations du terrain puis réessayez.');
    }
  }
}
interface ManagedField {
  id: number;
  name: string;
  sport: string;
  hourlyPrice: number;
  active: boolean;
  confirmedBookings: number;
}

@Component({
  selector: 'app-owner-field-list',
  standalone: true,
  imports: [OwnerFieldEditor],
  template: `
    <section class="mt-6 rounded-3xl border border-line bg-surface p-5 sm:p-8">
      <h2 class="font-display text-2xl font-semibold">Mes terrains</h2>

      @if (error()) {
        <p role="alert" class="mt-4 text-error">{{ error() }}</p>
      }

      @if (notice()) {
        <p role="status" class="mt-4">{{ notice() }}</p>
      }

      @if (loading()) {
        <p role="status" class="mt-4 text-muted">Chargement des terrains…</p>
      } @else if (loadFailed()) {
        <button type="button" class="button-secondary mt-4" (click)="load()">
          Réessayer
        </button>
      } @else if (fields().length === 0) {
        <p class="mt-4 text-muted">
          Votre complexe ne contient encore aucun terrain.
        </p>
      } @else {
        <ul class="mt-5 grid gap-3">
          @for (field of fields(); track field.id) {
            <li class="rounded-2xl border border-line p-4 sm:p-5">
              <div class="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 class="text-lg font-semibold">{{ field.name }}</h3>

                  <p class="mt-1 text-sm text-muted">
                    {{ sportLabels[field.sport] || field.sport }}
                    · {{ field.hourlyPrice }} MAD / heure
                  </p>

                  <p class="mt-2 text-sm font-semibold">
                    {{ field.active ? 'En service' : 'Hors service' }}
                  </p>
                </div>

                @if (confirmId() !== field.id && editingId() === null) {
                  <div class="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      class="button-secondary"
                      [disabled]="savingId() !== null"
                      (click)="openEditor(field.id)"
                    >
                      Modifier
                    </button>

                    <button
                      type="button"
                      class="button-secondary"
                      [disabled]="savingId() !== null"
                      (click)="requestChange(field)"
                    >
                      {{ field.active ? 'Mettre hors service' : 'Remettre en service' }}
                    </button>
                  </div>
                }
              </div>

              @if (confirmId() === field.id) {
                <div class="mt-4 border-t border-line pt-4">
                  <p>
                    Fermer <strong>{{ field.name }}</strong> aux nouvelles réservations ?
                  </p>

                  @if (field.confirmedBookings > 0) {
                    <p class="mt-2 text-sm">
                      Réservations confirmées en cours ou à venir :
                      <strong>{{ field.confirmedBookings }}</strong>.
                      Elles resteront confirmées. Consultez « Réservations reçues »
                      pour les traiter.
                    </p>
                  }

                  <div class="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      class="button-primary"
                      [disabled]="savingId() !== null"
                      (click)="save(field, false)"
                    >
                      {{ savingId() === field.id ? 'Enregistrement…' : 'Confirmer la mise hors service' }}
                    </button>

                    <button
                      type="button"
                      class="button-secondary"
                      [disabled]="savingId() !== null"
                      (click)="confirmId.set(null)"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              }
              @if (editingId() === field.id) {
                <app-owner-field-editor
                  [fieldId]="field.id"
                  (closed)="editingId.set(null)"
                  (saved)="afterEdit()"
                />
              }
            </li>
          }
        </ul>
      }
    </section>
  `
})
export class OwnerFieldList {
  private readonly http = inject(HttpClient);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);

  readonly fields = signal<ManagedField[]>([]);
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly savingId = signal<number | null>(null);
  readonly confirmId = signal<number | null>(null);
  readonly error = signal('');
  readonly notice = signal('');
  readonly editingId = signal<number | null>(null);


  openEditor(fieldId: number): void {
    this.confirmId.set(null);
    this.notice.set('');
    this.error.set('');
    this.editingId.set(fieldId);
  }

  afterEdit(): void {
    this.editingId.set(null);
    this.notice.set('Les modifications du terrain ont été enregistrées.');
    this.load();
  }

  readonly sportLabels: Record<string, string> = {
    FOOTBALL: 'Football',
    PADEL: 'Padel',
    TENNIS: 'Tennis',
    BASKETBALL: 'Basket'
  };

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
    this.loadFailed.set(false);
    this.error.set('');

    this.http.get<ManagedField[]>('/api/v1/owner/fields/management', {
      headers: { Authorization: 'Bearer ' + token }
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: fields => this.fields.set(fields),
      error: (err: HttpErrorResponse) => {
        this.loadFailed.set(true);
        this.handleError(err);
      }
    });
  }

  requestChange(field: ManagedField): void {
    this.error.set('');
    this.notice.set('');

    if (field.active) {
      this.confirmId.set(field.id);
    } else {
      this.confirmId.set(null);
      this.save(field, true);
    }
  }

  save(field: ManagedField, active: boolean): void {
    if (this.savingId() !== null) return;

    const token = this.session.token();
    if (!token) {
      this.session.expire();
      return;
    }

    this.savingId.set(field.id);
    this.error.set('');
    this.notice.set('');

    this.http.put<void>(
      '/api/v1/owner/fields/' + field.id + '/state',
      { active },
      { headers: { Authorization: 'Bearer ' + token } }
    ).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.savingId.set(null))
    ).subscribe({
      next: () => {
        this.confirmId.set(null);
        this.notice.set(
          active
            ? '« ' + field.name + ' » a été remis en service.'
            : '« ' + field.name + ' » est maintenant hors service.'
        );
        this.load();
      },
      error: (err: HttpErrorResponse) => this.handleError(err)
    });
  }

  private handleError(err: HttpErrorResponse): void {
    if (err.status === 401) {
      this.session.expire();
      return;
    }

    this.error.set(
      err.status === 403
        ? 'Votre compte ne peut pas gérer ces terrains.'
        : 'La demande a échoué. Actualisez la page pour vérifier l’état du terrain.'
    );
  }
}
