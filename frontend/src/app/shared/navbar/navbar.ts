import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

import { AuthApi } from '../../core/services/auth-api';
import { AuthSession } from '../../core/services/auth-session';
import { homeForRole } from '../../core/services/admin-guard';
import { ThemeToggle } from '../theme-toggle/theme-toggle';

interface NavItem {
  label: string;
  path: string;
  fragment?: string;
}

const VISITOR_LINKS: NavItem[] = [
  { label: 'Les sports', path: '/', fragment: 'sports' },
  { label: 'Comment ça marche', path: '/', fragment: 'comment-ca-marche' },
  { label: 'Pour les clubs', path: '/', fragment: 'clubs' }
];

const CLIENT_LINKS: NavItem[] = [
  { label: 'Explorer les terrains', path: '/', fragment: 'terrains' },
  { label: 'Mes réservations', path: '/mes-reservations' },
  { label: 'Paramètres', path: '/parametres' }
];

const OWNER_LINKS: NavItem[] = [
  { label: 'Mon activité', path: '/proprietaire' },
  {
    label: 'Réservations reçues',
    path: '/proprietaire',
    fragment: 'reservations'
  },
  { label: 'Réserver un terrain', path: '/', fragment: 'terrains' },
  { label: 'Mes réservations', path: '/mes-reservations' }
];

const ADMIN_LINKS: NavItem[] = [
  { label: 'Vue d’ensemble', path: '/admin' },
  { label: 'Utilisateurs', path: '/admin', fragment: 'utilisateurs' },
  { label: 'Réservations', path: '/admin', fragment: 'reservations' },
  { label: 'Demandes propriétaires', path: '/admin/demandes-proprietaire' }
];

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, ThemeToggle],
  templateUrl: './navbar.html'
})
export class Navbar {
  readonly session = inject(AuthSession);
  private readonly api = inject(AuthApi);

  readonly menuOpen = signal(false);
  private readonly retryCount = signal(0);

  // Le profil est relu à la connexion, au changement de session
  // ou lorsque l’utilisateur clique sur « Réessayer ».
  private readonly profileRequest = computed(() => ({
    token: this.session.signedIn() ? this.session.token() : null,
    attempt: this.retryCount()
  }));

  private readonly profileState = toSignal(
    toObservable(this.profileRequest).pipe(
      switchMap(({ token }) => {
        if (!token) {
          return of({ role: '', failed: false });
        }

        return this.api.getMyProfile(token).pipe(
          map(profile => ({ role: profile.role, failed: false })),
          startWith({ role: '', failed: false }),
          catchError(() => of({ role: '', failed: true }))
        );
      })
    ),
    { initialValue: { role: '', failed: false } }
  );

  readonly profileFailed = computed(() =>
    this.session.signedIn() && this.profileState().failed
  );

  readonly home = computed(() => {
    if (!this.session.signedIn()) return '/';

    const role = this.profileState().role;
    return role ? homeForRole(role) : '/profil';
  });

  readonly navItems = computed<NavItem[]>(() => {
    if (!this.session.signedIn()) return VISITOR_LINKS;

    switch (this.profileState().role) {
      case 'ADMIN':
        return ADMIN_LINKS;
      case 'OWNER':
        return OWNER_LINKS;
      case 'CLIENT':
        return CLIENT_LINKS;
      default:
        return [];
    }
  });

  toggleMenu(): void {
    this.menuOpen.update(open => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  retryProfile(): void {
    this.retryCount.update(value => value + 1);
  }

  logout(): void {
    this.closeMenu();
    this.session.logout();
  }
}
