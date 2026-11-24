import { computed, inject, Injectable, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LoginResponse } from './auth-api';

@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly router = inject(Router);
  private readonly current = signal<LoginResponse | null>(null);
  private expiryTimer?: ReturnType<typeof setTimeout>;
  private readonly storageKey = 'sportify.session';

  constructor() {
    this.restoreSession();
  }

  private restoreSession(): void {
    if (typeof window === 'undefined') return;

    const saved = sessionStorage.getItem(this.storageKey);
    if (!saved) return;

    try {
      const session: LoginResponse = JSON.parse(saved);
      const expiresAt = Date.parse(session.expiresAt);

      if (
        !session.accessToken ||
        !Number.isFinite(expiresAt) ||
        expiresAt <= Date.now()
      ) {
        this.clear();
        return;
      }

      // Restaure le signal et relance le minuteur d'expiration existant.
      this.start(session);
    } catch {
      this.clear();
    }
  }

  readonly signedIn = computed(() => this.current() !== null);

  start(response: LoginResponse): void {
    this.clear();
    const remaining = Date.parse(response.expiresAt) - Date.now();

    if (!Number.isFinite(remaining) || remaining <= 0) return;

    this.current.set(response);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(this.storageKey, JSON.stringify(response));
    }
    this.expiryTimer = setTimeout(() => this.expire(), remaining);
  }

  token(): string | null {
    const session = this.current();
    if (!session || Date.parse(session.expiresAt) <= Date.now()) return null;
    return session.accessToken;
  }

  logout(): void {
    this.clear();
    void this.router.navigateByUrl('/login');
  }

  expire(): void {
    this.clear();
    void this.router.navigate(['/login'], {
      queryParams: { expired: 1 },
      replaceUrl: true
    });
  }

  private clear(): void {
    clearTimeout(this.expiryTimer);
    this.current.set(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(this.storageKey);
    }
  }
}

export const requireLogin: CanActivateFn = () => {
  const session = inject(AuthSession);
  const router = inject(Router);
  return session.token() !== null || router.createUrlTree(['/login']);
};
