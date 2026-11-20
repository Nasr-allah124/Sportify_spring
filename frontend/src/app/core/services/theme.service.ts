import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly current = signal<Theme>(
    this.document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );

  readonly theme = this.current.asReadonly();
  readonly isDark = computed(() => this.current() === 'dark');

  toggle(): void {
    const theme: Theme = this.isDark() ? 'light' : 'dark';
    this.current.set(theme);
    this.document.documentElement.classList.toggle('dark', theme === 'dark');
    this.document.documentElement.style.colorScheme = theme;

    try {
      this.document.defaultView?.localStorage.setItem('sportify-theme', theme);
    } catch {
      // The current tab can still switch theme when storage is unavailable.
    }
  }
}
