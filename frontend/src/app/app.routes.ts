import { Routes } from '@angular/router';
import { requireLogin } from './core/services/auth-session';
import { requireAdmin, requireOwner } from './core/services/admin-guard';

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
  {
  path: 'terrains/:id',
  title: 'Détail du terrain | Sportify',
    canActivate: [requireLogin],
  loadComponent: () =>
    import('./features/field-detail/field-detail')
      .then(module => module.FieldDetail)
},
{
  path: 'mes-reservations',
  title: 'Mes réservations | Sportify',
  canActivate: [requireLogin],
  loadComponent: () =>
    import('./features/my-reservations/my-reservations')
      .then(module => module.MyReservations)
},
{
  path: 'admin/demandes-proprietaire',
  title: 'Demandes propriétaire | Sportify',
  canActivate: [requireLogin],
  loadComponent: () =>
    import('./features/admin-owner-applications/admin-owner-applications')
      .then(module => module.AdminOwnerApplications)
},
  {
    path: 'admin/demandes-proprietaire',
    title: 'Demandes de propriétaires | Sportify',
    canActivate: [requireAdmin],
    loadComponent: () =>
      import('./features/admin-owner-applications/admin-owner-applications')
        .then(m => m.AdminOwnerApplications)
  },
  {
    path: 'admin',
    title: 'Administration | Sportify',
    data: { space: 'admin' },
    canActivate: [requireAdmin],
    loadComponent: () => import('./features/workspace-dashboard/workspace-dashboard')
      .then(m => m.WorkspaceDashboard)
  },
  {
    path: 'proprietaire',
    title: 'Mon activité | Sportify',
    data: { space: 'owner' },
    canActivate: [requireOwner],
    loadComponent: () => import('./features/workspace-dashboard/workspace-dashboard')
      .then(m => m.WorkspaceDashboard)
  },
  {
    path: 'proprietaire/complexes/nouveau',
    title: 'Créer mon complexe | Sportify',
    canActivate: [requireOwner],
    loadComponent: () =>
      import('./features/owner/owner-field-create')
        .then(module => module.OwnerFieldCreate)
  },
  { path: '**', redirectTo: '' }
];
