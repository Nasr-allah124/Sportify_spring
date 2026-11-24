import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { AuthApi } from '../../../core/services/auth-api';
import { AuthSession } from '../../../core/services/auth-session';
import { GoogleAuthButton } from '../../../shared/google-auth-button/google-auth-button';
import { homeForRole } from '../../../core/services/admin-guard';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, GoogleAuthButton],
  templateUrl: './login.html'
})
export class Login {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(AuthApi);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private openAccountHome(): void {
    const token = this.session.token();

    if (!token) {
      this.session.expire();
      return;
    }

    this.api.getMyProfile(token).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: profile => {
        void this.router.navigateByUrl(homeForRole(profile.role), {
          replaceUrl: true
        });
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 401) {
          this.session.expire();
          return;
        }

        this.error.set('Impossible de charger votre espace. Réessayez.');
      }
    });
  }

  readonly busy = signal(false);
  readonly error = signal('');
  readonly pendingId = signal<number | null>(null);
  readonly expired = this.route.snapshot.queryParamMap.get('expired') === '1';

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', Validators.required]
  });

  login(): void {
    if (this.busy()) return;

    this.error.set('');
    this.pendingId.set(null);

    const email = this.form.controls.email;
    email.setValue(email.value.trim());

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const data = this.form.getRawValue();
    this.busy.set(true);

    this.api.login(data.email, data.password).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.busy.set(false))
    ).subscribe({
      next: response => {
        this.session.start(response);
        this.form.controls.password.reset();
        this.openAccountHome();
      },
      error: (err: HttpErrorResponse) => {
        const body = err.error;

        if (err.status === 403 && body?.code === 'EMAIL_NOT_VERIFIED') {
          this.pendingId.set(body.userId);
          this.error.set('Votre adresse email attend encore sa vérification.');
        } else if (err.status === 403 && body?.code === 'ACCOUNT_DISABLED') {
          this.error.set('Votre compte est désactivé.');
        } else if (err.status === 401) {
          this.error.set('Adresse email ou mot de passe incorrect.');
        } else if (err.status === 400) {
          this.error.set('Vérifiez le format de votre email et renseignez votre mot de passe.');
        } else if (err.status === 0) {
          this.error.set('Impossible de joindre Sportify. Vérifiez votre connexion.');
        } else {
          this.error.set('La connexion est momentanément indisponible.');
        }
      }
    });
  }
}
