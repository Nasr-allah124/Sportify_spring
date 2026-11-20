import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.html'
})
export class Landing {
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
