import { Component, inject } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  template: `
    <button
      type="button"
      class="flex size-11 items-center justify-center rounded-full border
             border-line bg-surface text-xl text-ink hover:bg-soft"
      [attr.aria-label]="theme.isDark() ? 'Activer le mode clair' : 'Activer le mode sombre'"
      [attr.title]="theme.isDark() ? 'Mode clair' : 'Mode sombre'"
      [attr.aria-pressed]="theme.isDark()"
      (click)="theme.toggle()"
    >
      <span aria-hidden="true">{{ theme.isDark() ? '☀' : '☾' }}</span>
    </button>
  `
})
export class ThemeToggle {
  readonly theme = inject(ThemeService);
}
