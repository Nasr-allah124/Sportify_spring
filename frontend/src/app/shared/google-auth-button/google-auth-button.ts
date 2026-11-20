import {
  Component, DestroyRef, ElementRef, NgZone, afterNextRender,
  inject, model, signal, viewChild
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { AuthApi } from '../../core/services/auth-api';
import { AuthSession } from '../../core/services/auth-session';
import {
  connectGoogleButton,
  loadGoogleSignIn
} from '../../core/services/google-sign-in';

@Component({
  selector: 'app-google-auth-button',
  standalone: true,
  template: `
    <div class="my-5 flex items-center gap-3 text-xs text-muted">
      <span class="h-px flex-1 bg-line"></span>
      <span>ou</span>
      <span class="h-px flex-1 bg-line"></span>
    </div>

    <div class="mx-auto w-full max-w-[400px]" [attr.inert]="busy() ? '' : null">
      <div #buttonHost class="flex min-h-11 w-full justify-center"></div>
    </div>

    @if (message()) {
      <p role="alert" class="mt-4 rounded-xl bg-error-soft p-4 text-sm text-error">
        {{ message() }}
      </p>
    }
  `
})
export class GoogleAuthButton {
  readonly busy = model(false);
  readonly message = signal('');

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('buttonHost');
  private readonly api = inject(AuthApi);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => void this.mount());
  }

  private async mount(): Promise<void> {
    try {
      const google = await loadGoogleSignIn();
      if (this.destroyRef.destroyed) return;

      const host = this.host().nativeElement;
      const root = host.ownerDocument.documentElement;
      const disconnect = connectGoogleButton(google, credential => {
        this.zone.run(() => this.authenticate(credential));
      });

      let lastWidth = 0;
      let lastTheme = '';

      const render = () => {
        const width = Math.min(400, Math.floor(host.clientWidth));
        const theme = root.classList.contains('dark') ? 'filled_black' : 'outline';
        if (width <= 0 || (width === lastWidth && theme === lastTheme)) return;

        lastWidth = width;
        lastTheme = theme;
        host.replaceChildren();

        // Un contexte explicite évite un fond imposé par le navigateur
        // autour de l’iframe lorsque le thème de la page change.
        host.style.colorScheme = 'normal';

        google.renderButton(host, {
          theme,
          width: String(width),
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          locale: 'fr'
        });
      };

      const resize = new ResizeObserver(render);
      const themeChanges = new MutationObserver(render);

      this.destroyRef.onDestroy(() => {
        resize.disconnect();
        themeChanges.disconnect();
        disconnect();
      });

      resize.observe(host);
      themeChanges.observe(root, { attributes: true, attributeFilter: ['class'] });
      render();
    } catch {
      if (!this.destroyRef.destroyed) {
        this.message.set('Le bouton Google est indisponible. Vous pouvez continuer par email.');
      }
    }
  }

  private authenticate(credential: string): void {
    if (this.busy()) return;

    this.message.set('');
    this.busy.set(true);

    this.api.loginWithGoogle(credential).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.busy.set(false))
    ).subscribe({
      next: response => {
        this.session.start(response);
        void this.router.navigateByUrl('/profil', { replaceUrl: true });
      },
      error: (err: HttpErrorResponse) => {
        switch (err.error?.code) {
          case 'ACCOUNT_ALREADY_EXISTS':
            this.message.set('Cette adresse possède déjà un compte Sportify. Connectez-vous avec votre mot de passe.');
            break;
          case 'ACCOUNT_DISABLED':
            this.message.set('Votre compte Sportify est désactivé.');
            break;
          case 'EMAIL_VERIFICATION_REQUIRED':
            this.message.set('Utilisez le formulaire d’inscription par email pour vérifier cette adresse.');
            break;
          case 'INVALID_GOOGLE_TOKEN':
            this.message.set('La connexion Google a expiré ou est invalide. Réessayez avec Google.');
            break;
          default:
            this.message.set('Impossible de terminer la connexion avec Google. Réessayez dans un instant.');
        }
      }
    });
  }
}
