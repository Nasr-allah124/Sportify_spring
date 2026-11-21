import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { Router, RouterLink } from '@angular/router';

import { ProfileApi, UpdateProfileRequest, UserProfile } from '../../core/services/profile-api';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './edit-profile.html'
})
export class EditProfile {
  private readonly router = inject(Router);
  private readonly api = inject(ProfileApi);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = signal<UserProfile | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');

  readonly form = this.fb.group({
    firstName: ['', [
      Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)
    ]],
    lastName: ['', [
      Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)
    ]],
    phone: ['', Validators.maxLength(30)]
  });

  constructor() {
    this.loadProfile();
  }

  loadProfile(): void {
    if (this.loading()) return;

    this.error.set('');
    this.loading.set(true);

    this.api.getMe().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: profile => this.fillForm(profile),
      error: (err: HttpErrorResponse) => this.showError(err, 'charger')
    });
  }

  save(): void {
    const profile = this.profile();
    if (!profile || this.saving()) return;

    this.error.set('');
    this.success.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const values = this.form.getRawValue();
    const firstName = values.firstName.trim();
    const lastName = values.lastName.trim();
    const phone = values.phone.trim();

    const changes: UpdateProfileRequest = {};
    if (firstName !== profile.firstName) changes.firstName = firstName;
    if (lastName !== profile.lastName) changes.lastName = lastName;
    if (phone !== (profile.phone ?? '')) changes.phone = phone;

    if (Object.keys(changes).length === 0) {
      this.fillForm(profile);
      return;
    }

    this.saving.set(true);

    this.api.updateMe(changes).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: () => {
        void this.router.navigateByUrl('/profil', { replaceUrl: true });
      },
      error: (err: HttpErrorResponse) => this.showError(err, 'enregistrer')
    });
  }

  private fillForm(profile: UserProfile): void {
    this.profile.set(profile);
    this.form.reset({
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone ?? ''
    });
  }

  private showError(err: HttpErrorResponse, action: 'charger' | 'enregistrer'): void {
    switch (err.status) {
      case 0:
        this.error.set('Impossible de joindre Sportify. Vérifiez votre connexion.');
        break;
      case 400:
        this.error.set('Vérifiez le prénom, le nom et le numéro de téléphone.');
        break;
      case 401:
        this.error.set('Votre session a expiré. Reconnectez-vous pour continuer.');
        break;
      case 403:
        this.error.set('Le serveur a refusé cette opération sur votre profil.');
        break;
      default:
        this.error.set(`Impossible de ${action} votre profil. Réessayez dans un instant.`);
    }
  }
}
