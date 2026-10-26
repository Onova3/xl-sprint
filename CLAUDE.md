# XL Sprint — règles du projet

Site d'entraînement à la vitesse sur Excel pour l'Excel esports, universel (toutes langues d'Excel, séparateurs et claviers). La spécification complète est dans `docs/SPEC.md` : lisez-la avant toute tâche importante.

## Stack
- Vite + TypeScript strict, **sans framework UI** : modules TS et rendu DOM simple, comme dans la v1.1. Proposez Preact seulement si une raison précise le justifie.
- Tests : Vitest. Le moteur, `localize`, le scoring et la répétition espacée ont des tests unitaires.
- Deux sorties de build :
  - `npm run build` : site statique pour GitHub Pages ;
  - `npm run build:single` : `dist/xl-sprint.html`, fichier unique hors ligne (vite-plugin-singlefile).
- Aucune dépendance réseau à l'exécution : polices avec repli système, aucune API externe obligatoire.

## Organisation cible
```
src/
  engine/        moteur de formules (port TS de reference/engine.js)
  localize/      toLocal / toCanonical, listes de fonctions par langue
  input/         clavier (e.code), dispositions, détection getLayoutMap
  drills/        un module par type d'exercice (keys, typing, formula, eval, regex, vba, case, sprint)
  pedagogy/      coach Tab, analyse des symboles, info-bulles, diagnostic, répétition espacée
  storage/       progression (localStorage + export/import JSON), versionnée avec migrations
  i18n/          messages fr.json, en.json
  ui/            mise en page, composants, thèmes
data/            contenu neutre (JSON) — voir data/schema/exercise.schema.json
reference/       v1.1 et moteur d'origine : NE PAS MODIFIER, ils servent de référence
```

## Règles
- **Contenu neutre** : les formules sont stockées en syntaxe canonique en-US. Ne stockez jamais une formule déjà traduite.
- **Toute chaîne visible** passe par l'i18n (fr et en). Les termes Excel restent dans la langue d'Excel du joueur.
- **N'inventez aucune donnée localisée.** Traductions de fonctions, raccourcis, KeyTips et séparateurs : soit une source officielle citée, soit le statut « à vérifier » affiché dans l'interface.
- **Pas de régression par rapport à la v1.1** : chaque fonctionnalité de `reference/xl-sprint-v1.1.html` doit exister dans le nouveau code, avec le même comportement ou un meilleur.
- Les raccourcis se détectent avec `KeyboardEvent.code` (touche physique), jamais avec `key` seul.
- Identité visuelle de la v1.1 à conserver :
  - fond quadrillé façon feuille de calcul ;
  - cellule active verte avec poignée de recopie ;
  - polices Bricolage Grotesque (titres), IBM Plex Sans (texte) et JetBrains Mono (code) ;
  - jetons de couleur clairs et sombres.
- Accessibilité : focus visible, `prefers-reduced-motion`, aucune information portée seulement par la couleur, mise en page correcte à 400 px.
- Avant chaque commit : `npm test` et `npm run build:single` passent.
- Commits petits et décrits en français. Une phase de la feuille de route = une branche.

## Le joueur principal
Il utilise Excel 365 en anglais avec un clavier QWERTY US et parle français. Son point faible est la frappe rapide des formules. Le site doit pourtant convenir à n'importe qui ailleurs dans le monde.
