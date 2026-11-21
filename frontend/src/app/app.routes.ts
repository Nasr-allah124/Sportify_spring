import { Routes } from '@angular/router';
import { requireLogin } from './core/services/auth-session';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Sportify | Votre prochain match commence ici',
    loadComponent: () => import('./features/landing/landing').then(module => module.Landing)
  },
  {
    path: 'profil',
    title: 'Mon profil | Sportify',
    canActivate: [requireLogin],
    loadComponent: () => import('./features/profile/profile')
      .then(module => module.Profile)
  },
  {
    path: 'register',
    title: 'Créer mon compte | Sportify',
    loadComponent: () => import('./features/auth/register/register').then(module => module.Register)
  },
  {
    path: 'login',
    title: 'Se connecter | Sportify',
    loadComponent: () => import('./features/auth/login/login').then(module => module.Login)
  },
  { path: 'inscription', redirectTo: 'register', pathMatch: 'full' },
  { path: 'connexion', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'parametres',
    title: 'Paramètres | Sportify',
    canActivate: [requireLogin],
    loadComponent: () =>
      import('./features/settings/settings').then(m => m.Settings)
  },
  {
    path: 'profil/modifier',
    title: 'Modifier mon profil | Sportify',
    canActivate: [requireLogin],
    loadComponent: () =>
      import('./features/profile/edit-profile').then(m => m.EditProfile)
  },
  { path: '**', redirectTo: '' }
];
