import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthSession } from '../../core/services/auth-session';

import { ThemeToggle } from '../theme-toggle/theme-toggle';


@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, ThemeToggle],
  templateUrl: './navbar.html'
})
export class Navbar {
  readonly menuOpen = signal(false);
  readonly links = [
    { text: 'Les sports', fragment: 'sports' },
    { text: 'Comment ça marche', fragment: 'fonctionnement' },
    { text: 'Pour les clubs', fragment: 'clubs' }
  ];
  readonly session = inject(AuthSession);

  toggleMenu(): void {
    this.menuOpen.update(open => !open);
  }

  constructor() {
    inject(Router).events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed(inject(DestroyRef))
    ).subscribe(() => this.menuOpen.set(false));
  }
}
