import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { AuthApi } from '../../../core/services/auth-api';
import { GoogleAuthButton } from '../../../shared/google-auth-button/google-auth-button';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, GoogleAuthButton],
  templateUrl: './register.html'
})
export class Register {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly pendingId = Number(this.route.snapshot.queryParamMap.get('verify'));

  readonly userId = signal<number | null>(
    Number.isSafeInteger(this.pendingId) && this.pendingId > 0 ? this.pendingId : null
  );
  readonly loading = signal(false);
  readonly resending = signal(false);
  readonly resendMessage = signal('');
  readonly verified = signal(false);
  readonly errorMessage = signal('');

  readonly registrationForm = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
    lastName: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/\S/)]]
  });

  readonly verificationForm = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]]
  });

  register(): void {
    if (this.loading()) return;

    this.errorMessage.set('');
    const email = this.registrationForm.controls.email;
    email.setValue(email.value.trim());

    if (this.registrationForm.invalid) {
      this.registrationForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.api.register(this.registrationForm.getRawValue()).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: response => {
        this.userId.set(response.userId);
        this.registrationForm.controls.password.reset();
        // The identifier keeps the verification screen available after a refresh.
        // The code is still required by the server to verify this account.
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { verify: response.userId },
          replaceUrl: true
        });
      },
      error: (error: HttpErrorResponse) => {
        switch (error.status) {
          case 409:
            this.errorMessage.set('Cette adresse email est déjà utilisée. Si vous avez déjà créé un compte, utilisez la même inscription pour terminer sa vérification.');
            break;
          case 400:
            this.errorMessage.set('Les informations saisies sont invalides. Vérifiez les champs du formulaire.');
            break;
          case 403:
            this.errorMessage.set('Le serveur a refusé la demande d’inscription.');
            break;
          case 0:
            this.errorMessage.set('Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.');
            break;
          default:
            this.errorMessage.set('Le service d’inscription est momentanément indisponible. Réessayez plus tard.');
        }
      }
    });
  }
  resendCode(): void {
    const userId = this.userId();

    if (userId === null || this.loading() || this.resending()) {
      return;
    }

    this.errorMessage.set('');
    this.resendMessage.set('');
    this.resending.set(true);

    this.api.resendCode(userId).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.resending.set(false))
    ).subscribe({
      next: () => {
        this.verificationForm.reset();
        this.resendMessage.set(
          'Si votre compte est en attente de vérification, consultez votre boîte mail et utilisez le dernier code reçu.'
        );
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 429) {
          const seconds = Number(error.headers.get('Retry-After'));

          this.errorMessage.set(
            seconds > 0
              ? `Vous pourrez demander un nouveau code dans ${seconds} secondes.`
              : 'Patientez avant de demander un nouveau code.'
          );
          return;
        }

        this.errorMessage.set('Le renvoi du code a échoué. Réessayez dans un instant.');
      }
    });
  }

  verifyEmail(): void {
    const userId = this.userId();
    if (this.loading() || this.resending() || userId === null) return;

    this.resendMessage.set('');

    this.errorMessage.set('');
    if (this.verificationForm.invalid) {
      this.verificationForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    this.api.verifyEmail(userId, this.verificationForm.controls.code.value).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: () => {
        this.verified.set(true);
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true
        });
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 400) {
          const messages: Record<string, string> = {
            CODE_INCORRECT: 'Code incorrect. Vérifiez les six chiffres du dernier email reçu.',
            CODE_EXPIRED: 'Ce code a expiré. Cliquez sur « Renvoyer le code » pour en recevoir un nouveau.',
            CODE_BLOCKED: 'Vous avez atteint les cinq essais. Cliquez sur « Renvoyer le code » pour continuer.',
            NO_PENDING_VERIFICATION: 'Aucune vérification en attente pour ce compte. Si vous avez déjà confirmé votre adresse, la vérification est terminée.'
          };

          const code = error.error?.code;
          this.errorMessage.set(
            messages[code] ?? 'La demande de vérification est invalide. Vérifiez que le code contient six chiffres.'
          );
          return;
        }

        if (error.status === 403) {
          this.errorMessage.set('Le serveur a refusé la demande de vérification.');
          return;
        }

        if (error.status === 0) {
          this.errorMessage.set('Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.');
          return;
        }

        this.errorMessage.set('Le service de vérification est momentanément indisponible. Réessayez plus tard.');
      }
    });
  }
}
