import { computed, inject, Injectable, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LoginResponse } from './auth-api';

@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly router = inject(Router);
  private readonly current = signal<LoginResponse | null>(null);
  private expiryTimer?: ReturnType<typeof setTimeout>;

  readonly signedIn = computed(() => this.current() !== null);

  start(response: LoginResponse): void {
    this.clear();
    const remaining = Date.parse(response.expiresAt) - Date.now();

    if (!Number.isFinite(remaining) || remaining <= 0) return;

    this.current.set(response);
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
  }
}

export const requireLogin: CanActivateFn = () => {
  const session = inject(AuthSession);
  const router = inject(Router);
  return session.token() !== null || router.createUrlTree(['/login']);
};
