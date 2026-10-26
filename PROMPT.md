Tu reprends le projet XL Sprint : un site d'entraînement à la vitesse sur Excel pour l'Excel esports, dans l'esprit de Monkeytype, mais plus pédagogique, et utilisable dans n'importe quel pays (toutes langues d'Excel, tous séparateurs, tous claviers).

## À lire d'abord
1. `CLAUDE.md` : règles du projet, stack et organisation.
2. `docs/SPEC.md` : vision, modèle d'universalité, pédagogie, mode Sprint et feuille de route en 4 phases.
3. `reference/xl-sprint-v1.1.html` : la version actuelle qui fonctionne (un seul fichier HTML). Ouvre-la et lis le code : c'est le comportement à conserver.
4. `reference/engine.js` et `reference/engine.test.js` : le moteur de formules et ses 92 vérifications (`node reference/engine.test.js`).
5. `data/` : contenu exporté au format neutre (exercices, raccourcis, claviers QWERTY US et AZERTY, correspondance des fonctions anglais-français, schéma JSON).

## Ta mission : la phase 1 (Fondations)
1. **Commence en mode plan.** Propose l'arborescence, les modules, les types TypeScript principaux (Profile, Exercise, Session, Progress) et l'ordre des commits. Pose-moi tes questions s'il y a une vraie décision à prendre, puis attends mon accord.
2. Initialise le projet : Vite + TypeScript strict, Vitest, ESLint et Prettier, scripts `dev`, `test`, `build`, `build:single` (vite-plugin-singlefile → `dist/xl-sprint.html`).
3. Porte le moteur en TypeScript (`src/engine/`), puis transforme `reference/engine.test.js` en tests Vitest, qui doivent rester verts.
4. Écris `src/localize/` : `toCanonical` et `toLocal`, basés sur des jetons. Ils gèrent les noms de fonctions, les séparateurs `,` et `;`, la décimale `.` et `,`, TRUE/VRAI et les constantes de tableau. Ajoute un test aller-retour sur **toutes** les solutions de `data/exercises/*.json` pour le profil fr-FR.
5. Porte les 8 étapes de la v1.1, sans régression, avec le contenu chargé depuis `data/`.
6. Ajoute le **profil du joueur** au premier lancement : langue de l'interface (fr, en), langue des fonctions (en, fr), séparateurs, clavier (QWERTY US, AZERTY FR, détection automatique avec `navigator.keyboard.getLayoutMap()` si elle est disponible), version d'Excel (filtre `minExcel`).
7. Applique le profil partout : formules affichées et saisies dans la langue du joueur, complétion Tab sur les noms localisés (noms LET et LAMBDA toujours en premier), raccourcis signalés « non vérifié pour votre configuration » quand la donnée manque.
8. Ajoute l'i18n de l'interface en fr et en, et l'export et l'import de la progression en JSON. Reprends la progression `localStorage` de la v1.1 (clé `xlsprint.progress.v1`) avec une migration.
9. Mets en place une GitHub Action : tests, build, puis déploiement sur GitHub Pages.

## Critères de réussite
- Les 8 étapes fonctionnent avec deux profils : « Excel anglais + `,` + QWERTY US » et « Excel français + `;` + AZERTY FR ».
- `npm test` est vert, y compris l'aller-retour `localize` sur tout le contenu.
- `dist/xl-sprint.html` s'ouvre par double-clic, hors ligne, sans erreur dans la console.
- Aucune traduction ni aucun raccourci inventé : chaque ajout est sourcé ou marqué « à vérifier ».

## Ensuite
Arrête-toi à la fin de la phase 1. Fais-moi un compte rendu : ce qui est fait, ce que tu n'as pas pu vérifier, et ta proposition pour la phase 2 (mode Sprint, coach Tab, analyse des symboles, info-bulle des arguments).
