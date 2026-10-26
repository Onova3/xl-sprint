# XL Sprint — spécification produit

## Vision

XL Sprint est un site d'entraînement à la vitesse sur Excel pour l'Excel esports, dans l'esprit de Monkeytype : on démarre en une touche, on rejoue sans fin, on voit sa progression. Il va plus loin que Monkeytype parce qu'il **enseigne** : il explique les formules, montre les arguments, diagnostique les erreurs et fait revenir ce qui est mal maîtrisé.

Il doit fonctionner pour **tout le monde, dans n'importe quel pays** : n'importe quelle langue d'Excel, n'importe quels séparateurs, n'importe quel clavier. Il reste gratuit, sans compte obligatoire, et fonctionne hors ligne.

## Point de départ

`reference/xl-sprint-v1.1.html` est la version actuelle, un fichier HTML unique qui fonctionne. Elle contient 8 étapes :

| # | Étape | Type | Validation |
|---|---|---|---|
| 1 | Navigation et saisie | raccourcis (41) | touche physique `e.code` + modificateurs |
| 2 | Mise en forme et ruban | raccourcis et séquences Alt (40) | idem, séquences Alt H … |
| 3 | Frappe de formules | recopie (60, 3 niveaux) | caractère par caractère, Tab = complétion |
| 4 | Écrire des formules | consigne → formule (30) | texte normalisé (v1) |
| 5 | Tableaux dynamiques | consigne → formule (24) | **calcul réel** par le moteur |
| 6 | Regex | cours, testeur, motifs (15), formules REGEX (15) | regex JS / calcul réel |
| 7 | VBA | recopie de macros (12) | caractère par caractère |
| 8 | Mini-cas | jeu de données aléatoire + question | réponse numérique ou texte |

Fonctions déjà présentes à conserver :
- record, courbe de progression et objectif par étape ;
- les exercices ratés reviennent plus souvent ;
- complétion Tab des fonctions **et des noms LET et LAMBDA**, les noms d'abord ;
- pause quand la fenêtre perd le focus ;
- stockage local (`localStorage`) ;
- thème clair et sombre.

Le moteur (`reference/engine.js`) analyse et calcule un sous-ensemble d'Excel 365 :
- tableaux dynamiques avec diffusion (broadcasting) ;
- LET, LAMBDA et appel direct `LAMBDA(x,x)(1)` ;
- MAKEARRAY, MAP, SCAN, REDUCE, BYROW, BYCOL ;
- TAKE, DROP, VSTACK, HSTACK, TOCOL, WRAPROWS, EXPAND, SORT, SORTBY, UNIQUE, FILTER, XLOOKUP (y compris le mode regex 3) ;
- les fonctions REGEX, SUMIFS, COUNTIFS et les fonctions texte ;
- il refuse `r` et `c` comme noms, comme Excel.

`reference/engine.test.js` contient 92 vérifications qui doivent rester vertes.

## Universalité : le modèle

### Profil du joueur (premier lancement, modifiable ensuite)
- **Langue de l'interface** : fr et en au départ, d'autres ensuite.
- **Langue des fonctions Excel** : en, fr au départ. Elle est indépendante des séparateurs.
- **Séparateurs** : liste `,` ou `;`, décimale `.` ou `,`. Ils sont proposés selon la langue, mais modifiables. Cas fréquent : Excel en anglais avec des paramètres régionaux français, donc des noms anglais avec `;`.
- **Clavier** : QWERTY US et AZERTY FR au départ. Détection automatique avec `navigator.keyboard.getLayoutMap()` quand le navigateur la propose, sinon choix manuel.
- **Système** : Windows en v1, Mac indiqué comme « bientôt ».
- **Version d'Excel** : 2016, 2019, 2021, 2024 ou 365. Elle masque les exercices qui demandent une version plus récente (`minExcel`).

### Contenu neutre
- Chaque formule est stockée **une seule fois**, en syntaxe canonique en-US : noms anglais, `,` entre arguments, `.` décimal, `{1,2;3,4}`.
- Un module `localize` convertit dans les deux sens : `toLocal(canonical, profile)` et `toCanonical(input, profile)`. Il travaille sur des jetons, jamais avec un simple remplacement de texte, et ne touche pas aux chaînes entre guillemets. Il traduit les noms de fonctions, les séparateurs, les nombres décimaux, TRUE et FALSE, et les séparateurs des constantes de tableau.
- Le moteur calcule toujours en canonique : la saisie du joueur passe par `toCanonical`.
- La complétion Tab utilise la liste des fonctions **dans la langue du joueur**, triée comme Excel la trie dans cette langue.
- Les textes affichés (consignes, indices, explications) sont des objets `{ en, fr, … }` avec repli sur l'anglais.

### Raccourcis
- La base de données est indexée par système × langue d'interface d'Excel × clavier. Seules les données Windows en anglais existent pour l'instant (`data/shortcuts/excel-windows-en.json`).
- Le champ `localized` signale ce qui peut changer : lettres mnémoniques (le gras est `Ctrl+G` en Excel français), séquences du ruban, touches de symboles ou de chiffres.
- Tant qu'une combinaison n'est pas vérifiée pour un profil, l'exercice affiche le badge « non vérifié pour votre configuration » au lieu d'enseigner quelque chose de faux.
- Un clavier est affiché à l'écran selon la disposition choisie (`data/keyboards/*.json`).

### Légèreté et accès
- Une version **fichier unique** (`dist/xl-sprint.html`) fonctionne hors ligne et se partage par message ou par clé USB.
- Une version **site** est déployée sur GitHub Pages.
- Elle devient installable (PWA) en phase 3.
- **Export et import de la progression** en JSON, pour qu'aucune donnée ne soit perdue sans compte.
- Accessibilité :
  - focus visible ;
  - respect de `prefers-reduced-motion` ;
  - couleurs qui ne portent jamais seules le sens ;
  - fonctionne sur un écran de 400 px de large (les exercices clavier signalent qu'un clavier physique est requis).

## Pédagogie (au-delà de Monkeytype)

1. **Coach de complétion Tab** : nombre minimal de frappes pour chaque formule dans la langue du joueur, puis « 41 frappes, minimum 27 » avec les endroits où vous avez tapé trop.
2. **Analyse des symboles** : temps et erreurs par caractère et par paire de caractères, affichés en carte de chaleur sur le clavier du joueur. Des exercices ciblés sont générés sur les symboles lents (`( ) " , ; $ : &`).
3. **Info-bulle des arguments** pendant la frappe, comme dans Excel : signature, argument en cours en gras, arguments facultatifs entre crochets.
4. **Débogueur** après un exercice calculé : valeur de chaque variable LET et étapes de SCAN et de REDUCE.
5. **Explication** de chaque solution, et solution la plus courte quand celle du joueur est plus longue.
6. **Diagnostic des erreurs** par type (parenthèse, séparateur, guillemet, `$`, nom de fonction, argument manquant), avec un conseil.
7. **Répétition espacée** (type SM-2 ou Leitner) : J+1, J+3, J+7, J+21.
8. **Carte de maîtrise** par fonction et par raccourci (découvert, pratiqué, rapide, maîtrisé) et arbre de compétences de SUM à MAKEARRAY.
9. **Leçons** : courte explication, exemple, pratique guidée, puis test chronométré.
10. **Difficulté adaptative**, objectif du jour et série de jours consécutifs.

## Mode Sprint (façon Monkeytype)

- Le test démarre à la **première touche**. Tab puis Entrée relance, Échap ouvre la palette de commandes.
- **Flux continu** : les formules s'enchaînent sans écran intermédiaire.
- Modes **temps** (15, 30, 60, 120 s) et **nombre** (5, 10, 25 formules), avec un record par mode, langue et clavier.
- Vitesse **en direct** et curseur fantôme au rythme du record.
- Résultats :
  - vitesse nette et brute (car./min et « formules/min ») ;
  - précision et régularité ;
  - courbe seconde par seconde avec les erreurs marquées.
- Variantes : sans retour arrière, arrêt à la première erreur, texte masqué.
- Interface épurée pendant le test. Thèmes, sons de frappe et police en option.

## Feuille de route

| Phase | Contenu | Critère de fin |
|---|---|---|
| **1. Fondations** | projet TypeScript et Vite, port de la v1.1 sans régression, profil, `localize` (en et fr), claviers QWERTY US et AZERTY, interface fr et en, export et import, CI, GitHub Pages et fichier unique | les 8 étapes marchent en profil « Excel anglais + QWERTY US » **et** « Excel français + `;` + AZERTY », tests verts |
| **2. Sprint** | mode Monkeytype, coach Tab, analyse des symboles et carte du clavier, info-bulle des arguments | une session de 30 s complète au clavier, sans souris |
| **3. Pédagogie** | débogueur, explications, diagnostic, répétition espacée, carte de maîtrise, leçons, PWA | parcours débutant → avancé jouable de bout en bout |
| **4. Communauté** | open source, éditeur d'exercices et packs JSON, nouvelles langues et claviers, classement (serveur léger) | une contribution externe fusionnée |

## Points à vérifier (ne pas inventer)

- **Traductions des fonctions.** `data/locales/functions.en-fr.json` sépare `verified` et `toVerify`. Tout ajout doit venir d'une source officielle Microsoft, citée dans le commit.
- **Séparateur de colonnes** des constantes de tableau en français : à tester dans un vrai Excel.
- **Raccourcis localisés** (lettres, ruban) et **raccourcis à chiffres ou symboles sur AZERTY** : à vérifier avant de les présenter comme corrects.
- **Disponibilité des fonctions dans Excel 2024** : le champ `minExcel` a été attribué de façon prudente (2021 ou 365).
