import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { ComplexLocationMap } from '../settings/complex-location-picker';

import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  finalize,
  Subscription,
  timeout,
  TimeoutError
} from 'rxjs';

import { CatalogApi, Field } from '../../core/services/catalog-api';
import { AuthSession } from '../../core/services/auth-session';
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, FormsModule, ComplexLocationMap],
  templateUrl: './landing.html'
})
export class Landing implements OnInit {
    private readonly catalogApi = inject(CatalogApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly session = inject(AuthSession);

  // Les résultats et les états d'affichage sont des signals.
  readonly fields = signal<Field[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly openMapFieldId = signal<number | null>(null);
  readonly missingCoverIds = signal<ReadonlySet<number>>(new Set());

  readonly sportLabels: Record<string, string> = {
    FOOTBALL: 'Football',
    PADEL: 'Padel',
    TENNIS: 'Tennis',
    BASKETBALL: 'Basket'
  };

  toggleFieldMap(fieldId: number): void {
    this.openMapFieldId.update(current => current === fieldId ? null : fieldId);
  }

  markCoverMissing(fieldId: number): void {
    this.missingCoverIds.update(current => {
      const updated = new Set(current);
      updated.add(fieldId);
      return updated;
    });
  }

  searchQuery = '';

  // On garde la recherche en cours pour pouvoir l'annuler.
  private searchSubscription?: Subscription;
private searchTimer?: ReturnType<typeof setTimeout>;
  ngOnInit(): void {
    if (this.session.signedIn()) {
      this.loadFields();
    }
  }
scheduleSearch(): void {
  // Annule l'attente et la requête précédentes.
  clearTimeout(this.searchTimer);
  this.searchSubscription?.unsubscribe();

  this.error.set('');
  this.fields.set([]);
  this.loading.set(true);

  // Attend 300 ms après la dernière modification.
  this.searchTimer = setTimeout(() => {
    this.loadFields();
  }, 300);
}
  loadFields(): void {
     clearTimeout(this.searchTimer);
    // Si l'utilisateur lance une nouvelle recherche,
    // on arrête la précédente.
    this.searchSubscription?.unsubscribe();

    this.loading.set(true);
    this.error.set('');
    this.fields.set([]);

    this.searchSubscription = this.catalogApi
      .searchFields(this.searchQuery)
      .pipe(
        // Si le serveur ne répond pas dans les 10 secondes,
        // on affiche une erreur au lieu d'attendre indéfiniment.
        timeout(10_000),

        // Arrête la requête si le composant est détruit.
        takeUntilDestroyed(this.destroyRef),

        // Exécuté quand la requête se termine, échoue ou est annulée.
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (fields) => {
          this.fields.set(fields);
        },

        error: (err: unknown) => {
          if (err instanceof TimeoutError) {
            this.error.set(
              'Le serveur met trop de temps à répondre. Réessayez.'
            );
          } else if (err instanceof HttpErrorResponse && err.status === 0) {
            this.error.set(
              'Impossible de joindre le serveur. Vérifiez que le backend est démarré.'
            );
          } else {
            this.error.set(
              'Une erreur est survenue pendant la recherche. Réessayez.'
            );
          }
        }
      });
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.loadFields();
  }
  constructor() {
  this.destroyRef.onDestroy(() => {
    clearTimeout(this.searchTimer);
  });
}
  readonly sports = [
    { name: 'Football', description: 'Le rendez-vous de votre équipe.', mark: '⚽' },
    { name: 'Padel', description: 'À quatre, le plaisir se partage.', mark: '↗' },
    { name: 'Tennis', description: 'Votre prochain échange vous attend.', mark: '◉' },
    { name: 'Basketball', description: 'Un terrain pour faire la différence.', mark: '◎' }
  ];

  readonly steps = [
    { title: 'Trouvez votre terrain', text: 'Choisissez votre sport et votre ville, puis découvrez les terrains des complexes.' },
    { title: 'Choisissez votre créneau', text: 'Consultez les horaires et sélectionnez une disponibilité adaptée à votre équipe.' },
    { title: 'Retrouvez-vous sur le terrain', text: 'Confirmez votre réservation et gardez les détails de votre partie dans votre espace.' }
  ];

  readonly faqs = [
    {
      question: 'Qu’est-ce que Sportify ?',
      answer: 'Sportify est une plateforme qui réunit les offres de plusieurs complexes sportifs. Elle facilite la recherche d’un terrain et l’organisation d’une partie entre amis.'
    },
    {
      question: 'Quels sports sont prévus sur la plateforme ?',
      answer: 'Sportify est conçu pour les terrains de football, de padel, de tennis et de basketball. L’offre dépendra des installations publiées par les complexes partenaires.'
    },
    {
      question: 'Pourquoi dois-je vérifier mon adresse email ?',
      answer: 'Après l’inscription, vous recevez un code à six chiffres pour confirmer l’accès à votre boîte mail. Saisissez-le dans les dix minutes pour vérifier votre compte.'
    },
    {
      question: 'Comment devenir propriétaire sur Sportify ?',
      answer: 'Créez d’abord un compte client. Le parcours propriétaire permettra ensuite de déposer une demande avec les informations de votre premier complexe, avant examen par l’administrateur.'
    },
    {
      question: 'Un propriétaire peut-il aussi réserver un terrain ?',
      answer: 'Oui. Le passage au rôle propriétaire conserve les possibilités de réservation du même compte. Chaque propriétaire gère uniquement ses propres installations.'
    },
    {
      question: 'Le paiement en ligne est-il prévu ?',
      answer: 'Le paiement en ligne est une évolution future. Les modalités de règlement se conviennent directement avec le complexe.'
    }
  ];
}
