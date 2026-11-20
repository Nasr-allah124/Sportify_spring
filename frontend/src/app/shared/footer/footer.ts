import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="border-t border-line">
      <div class="page-container flex flex-col gap-7 py-9 md:flex-row md:items-center md:justify-between">
        <a routerLink="/" class="font-display text-2xl font-bold tracking-tight">sportify.</a>
        <nav aria-label="Navigation de pied de page" class="flex flex-wrap gap-x-7 gap-y-3 text-sm text-muted">
          <a routerLink="/" fragment="sports" class="hover:text-ink">Les sports</a>
          <a routerLink="/" fragment="clubs" class="hover:text-ink">Pour les clubs</a>
          <a routerLink="/" fragment="faq" class="hover:text-ink">FAQ</a>
          <a routerLink="/register" class="hover:text-ink">Créer un compte</a>
        </nav>
        <p class="text-xs text-muted">© {{ year }} Sportify</p>
      </div>
    </footer>
  `
})
export class Footer {
  readonly year = new Date().getFullYear();
}
