import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthApi, UserProfile } from '../../core/services/auth-api';
import { AuthSession } from '../../core/services/auth-session';

@Component({
  selector: 'app-profile',
  standalone: true,
  template: `
    <section class="page-container py-12">
      <div class="mx-auto max-w-lg rounded-3xl border border-line bg-surface p-8">
        <h1 class="font-display text-3xl font-semibold">Mon profil</h1>

        @if (profile(); as user) {
          <p class="mt-5 text-xl">Bienvenue, {{ user.firstName }} !</p>
          <dl class="mt-5 grid gap-3">
            <div><dt class="text-sm text-muted">Nom complet</dt>
              <dd>{{ user.firstName }} {{ user.lastName }}</dd></div>
            <div><dt class="text-sm text-muted">Adresse email</dt>
              <dd>{{ user.email }}</dd></div>
            <div><dt class="text-sm text-muted">Rôle</dt>
              <dd>{{ user.role }}</dd></div>
          </dl>
        } @else if (error()) {
          <p role="alert" class="mt-5 text-error">{{ error() }}</p>
          <button type="button" class="button-secondary mt-3" (click)="load()">
            Réessayer
          </button>
        } @else {
          <p role="status" class="mt-5 text-muted">Chargement du profil…</p>
        }

        <button type="button" class="button-secondary mt-7" (click)="session.logout()">
          Se déconnecter
        </button>
      </div>
    </section>
  `
})
export class Profile {
  private readonly api = inject(AuthApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly session = inject(AuthSession);
  readonly profile = signal<UserProfile | null>(null);
  readonly error = signal('');

  constructor() {
    this.load();
  }

  load(): void {
    const token = this.session.token();
    if (!token) {
      this.session.expire();
      return;
    }

    this.error.set('');
    this.api.getMyProfile(token).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: user => this.profile.set(user),
      error: (err: HttpErrorResponse) => {
        if (err.status === 401) {
          this.session.expire();
        } else {
          this.error.set('Impossible de charger votre profil. Réessayez dans un instant.');
        }
      }
    });
  }
}
