/* Offre commerciale : le seul fichier à modifier pour fixer le prix et activer l'achat.
   Tant qu'un champ est vide, la page d'accueil affiche « à définir » ou « Bientôt disponible ». */

export interface Offer {
  /** Prix affiché tel quel, par exemple « 19 € » ou « $19 » ; null = « à définir ». */
  priceLabel: string | null;
  /** Période, par exemple « une fois » ou « par an » ; null = rien d'affiché. */
  period: { fr: string; en: string } | null;
  /** Lien de paiement (Stripe Payment Link, Lemon Squeezy…) ; vide = « Bientôt disponible ». */
  checkoutUrl: string;
  /** Adresse pour « Me prévenir » et le contact ; vide = lien masqué. */
  contactEmail: string;
}

export const OFFER: Offer = {
  priceLabel: null,
  period: null,
  checkoutUrl: '',
  contactEmail: '',
};
