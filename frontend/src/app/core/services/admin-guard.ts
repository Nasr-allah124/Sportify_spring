import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthApi } from './auth-api';
import { AuthSession } from './auth-session';

export function homeForRole(role: string): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'OWNER') return '/proprietaire';
  return '/';
}

function requireRole(role: string): CanActivateFn {
  return () => {
    const api = inject(AuthApi);
    const session = inject(AuthSession);
    const router = inject(Router);
    const token = session.token();

    if (!token) return router.createUrlTree(['/login']);

    return api.getMyProfile(token).pipe(
      map(profile => profile.role === role
        ? true
        : router.parseUrl(homeForRole(profile.role))),
      catchError((err: HttpErrorResponse) =>
        of(router.parseUrl(err.status === 401 ? '/login' : '/profil'))
      )
    );
  };
}

export const requireAdmin = requireRole('ADMIN');
export const requireOwner = requireRole('OWNER');
