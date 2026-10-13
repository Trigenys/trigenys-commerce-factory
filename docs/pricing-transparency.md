# Commerce Factory — cadre de tarifs transparents

Ce document prépare le chiffrage commercial demandé le 13 octobre 2026. Il ne fixe aucun tarif futur et n’active aucune facturation.

La bêta du catalogue et de l’espace marchand est actuellement gratuite. Le MCP est prévu comme service payant dans #69. Le modèle envisagé propose le SDK en téléchargement gratuit, avec les droits d’accès privés API/MCP rattachés à l’offre souscrite. Le téléchargement du SDK ne confère pas de droits payants.

Avant publication des offres commerciales, chaque formule doit indiquer :

- son prix en FCFA et les taxes applicables, ainsi que le total effectivement débité ;
- sa période de facturation, le renouvellement, la résiliation et le sort des données après résiliation ;
- les fonctions disponibles, le nombre de boutiques et les droits des collaborateurs ;
- les plafonds de produits, médias, stockage et appels API/MCP inclus ;
- la mesure réelle de consommation, les alertes et ce qui arrive à la limite : blocage, changement de formule ou dépassement explicitement accepté ;
- le prix de chaque dépassement éventuel, ou la confirmation qu’aucun dépassement n’est facturé ;
- les frais du moyen de règlement de l’abonnement Commerce Factory ;
- les coûts externes distincts : moyens de paiement du marchand, abonnements aux assistants IA et autres services de tiers ;
- les conditions de l’essai ou de la bêta, et la confirmation qu’une offre payante demande une action explicite.

Le marchand reçoit un récapitulatif avant souscription et retrouve prix, échéance, formule, quotas et historique dans son espace. Une reprise de requête ne produit ni un doublon ni une double facturation.

## Données à réunir pour chiffrer

1. Coûts observés d’hébergement, Postgres/Auth, médias et trafic, par boutique et par volume de catalogue.
2. Coût de support et coût des fonctions payantes réellement livrées.
3. Volumes et disposition à payer recueillis auprès des pilotes (#2/#44).
4. Hypothèses de marge et scénarios de consommation faible, normale et élevée.

Les prix et plafonds doivent découler de ces données. Une comparaison au marché pourra compléter le travail, avec date, sources et conversion monétaire explicites.

## Critères de livraison

- La landing affiche les mêmes prix et limites que l’espace marchand et le contrat de souscription, en FR/EN.
- Le total, la fréquence et le renouvellement sont visibles avant paiement.
- Les contrôles d’abonnement et de quota sont appliqués côté serveur et testés.
- Les frais du marchand et les paiements de ses clients restent distincts de l’abonnement Commerce Factory.
- Une offre prévue est présentée comme prévue, avec Contact comme destination, jusqu’à disponibilité réelle du paiement et des fonctions.

Lié à #69 et à la validation marchande #2. Les montants, les plafonds et le prestataire d’encaissement restent à définir.
