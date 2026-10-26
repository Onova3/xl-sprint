# Kit de démarrage XL Sprint pour Claude Code

## Contenu

| Élément | Rôle |
|---|---|
| `PROMPT.md` | Le message à envoyer à Claude Code (copiez-collez son contenu) |
| `CLAUDE.md` | Règles permanentes du projet : Claude Code le lit automatiquement à chaque session |
| `docs/SPEC.md` | Spécification complète : vision, universalité, pédagogie, mode Sprint, feuille de route |
| `reference/xl-sprint-v1.1.html` | La version actuelle du site, qui fonctionne |
| `reference/engine.js` | Le moteur de calcul des formules |
| `reference/engine.test.js` | 92 vérifications du moteur (`node reference/engine.test.js`) |
| `data/exercises/` | Les 156 exercices au format neutre : frappe, formules, tableaux dynamiques, regex, VBA |
| `data/shortcuts/` | Les 81 raccourcis Excel Windows (anglais), avec ce qu'il faut vérifier pour les autres langues |
| `data/keyboards/` | Dispositions QWERTY US et AZERTY FR |
| `data/locales/` | Noms de fonctions anglais-français (vérifiés ou à vérifier) et séparateurs par langue |
| `data/schema/` | Schéma JSON d'un exercice |

## Démarrer

1. Décompressez le dossier et renommez-le `xl-sprint`.
2. Ouvrez un terminal dans ce dossier, puis lancez `git init` et `claude`.
   - Avec Claude Code sur le web ou dans l'application, créez plutôt un dépôt GitHub `xl-sprint`, envoyez-y ces fichiers, puis ouvrez une session sur ce dépôt.
3. Copiez-collez le contenu de `PROMPT.md` comme premier message.
4. Claude Code commence par un plan : relisez-le, répondez à ses questions, puis validez.

Prérequis : Node.js 20 ou plus récent, et un compte GitHub si vous voulez le site en ligne sur GitHub Pages.
