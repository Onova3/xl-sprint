/* Cours Regex de l'étape 6 (texte de la v1.1), en fr et en.
   Les formules sont écrites en canonique et affichées dans la syntaxe du joueur. */

import { t, uiLang } from '../i18n';
import { fnName, loc } from '../state';
import { esc } from './dom';

const X = (f: string) => `<code>${esc(loc(f))}</code>`;
const C = (s: string) => `<code>${esc(s)}</code>`;
const pre = (lines: [string, string][]) => {
  const w = Math.max(...lines.map(([f]) => loc(f).length));
  return `<pre>${lines.map(([f, c]) => esc(loc(f).padEnd(w + 2)) + '→ ' + esc(c)).join('\n')}</pre>`;
};
const table = (head: string[], rows: string[][]) =>
  `<div class="xscroll"><table class="tbl"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;

export function courseHtml(): string {
  const fr = uiLang() === 'fr';
  const RT = fnName('REGEXTEST'),
    RE = fnName('REGEXEXTRACT'),
    RR = fnName('REGEXREPLACE');
  const T = fnName('TRUE'),
    F = fnName('FALSE');
  const L = (a: string, b: string) => (fr ? a : b);
  return `<div class="course">
  <section>
    <h3>${L("1. Les trois fonctions REGEX d'Excel", "1. Excel's three REGEX functions")}</h3>
    <p>${L("Office 365 propose trois fonctions qui utilisent des expressions régulières (moteur PCRE2). Le motif s'écrit entre guillemets, comme un texte.", 'Office 365 offers three functions that use regular expressions (PCRE2 engine). The pattern is written in quotation marks, like text.')}</p>
    ${table(
      [L('Fonction', 'Function'), L('Renvoie', 'Returns'), L('Arguments utiles', 'Useful arguments')],
      [
        [
          C(`${RT}(text, pattern, [case_sensitivity])`),
          `${T} / ${F}`,
          L(
            "Le motif est cherché <b>n'importe où</b> dans le texte.",
            'The pattern is searched for <b>anywhere</b> in the text.',
          ),
        ],
        [
          C(`${RE}(text, pattern, [return_mode], [case_sensitivity])`),
          L('du texte', 'text'),
          L(
            `${C('return_mode')} : 0 = première correspondance (défaut), 1 = toutes (déversées vers la droite), 2 = groupes de capture de la première. ${C('#N/A')} si rien n'est trouvé.`,
            `${C('return_mode')}: 0 = first match (default), 1 = all matches (spilled to the right), 2 = capture groups of the first match. ${C('#N/A')} when nothing is found.`,
          ),
        ],
        [
          C(`${RR}(text, pattern, replacement, [occurrence], [case_sensitivity])`),
          L('du texte', 'text'),
          L(
            `${C('occurrence')} : 0 = toutes (défaut), 2 = la deuxième, -1 = la dernière. ${C('$1')}, ${C('$2')}… reprennent les groupes.`,
            `${C('occurrence')}: 0 = all (default), 2 = the second, -1 = the last. ${C('$1')}, ${C('$2')}… insert the groups.`,
          ),
        ],
      ],
    )}
    <p>${L(
      `${C('case_sensitivity')} : 0 = respecte la casse (défaut), 1 = ignore la casse. Ces fonctions acceptent une plage : ${X('=REGEXTEST(A2:A100,"^\\d+$")')} déverse un résultat par cellule.`,
      `${C('case_sensitivity')}: 0 = case-sensitive (default), 1 = ignore case. These functions accept a range: ${X('=REGEXTEST(A2:A100,"^\\d+$")')} spills one result per cell.`,
    )}</p>
    <p>${L(
      `${fnName('XLOOKUP')} et ${fnName('XMATCH')} ont aussi un mode regex : ${C('match_mode = 3')}, par exemple ${X('=XLOOKUP("^INV-",A2:A100,B2:B100,,3)')}.`,
      `${fnName('XLOOKUP')} and ${fnName('XMATCH')} also have a regex mode: ${C('match_mode = 3')}, for example ${X('=XLOOKUP("^INV-",A2:A100,B2:B100,,3)')}.`,
    )}</p>
    <p>${L(
      `Les résultats de ${RE} sont du <b>texte</b> : ${X('=--REGEXEXTRACT(A2,"\\d+")')} ou ${C(fnName('VALUE') + '(…)')} pour obtenir un nombre.`,
      `${RE} returns <b>text</b>: use ${X('=--REGEXEXTRACT(A2,"\\d+")')} or ${C(fnName('VALUE') + '(…)')} to get a number.`,
    )}</p>
  </section>

  <section>
    <h3>${L('2. Caractères et classes', '2. Characters and classes')}</h3>
    ${table(
      [L('Motif', 'Pattern'), L('Correspond à', 'Matches'), L('Exemple', 'Example')],
      [
        [C('abc'), L('le texte exact « abc »', 'the exact text “abc”'), C('"INV"')],
        [
          C('.'),
          L("n'importe quel caractère (sauf retour à la ligne)", 'any character (except a line break)'),
          C('"A.C"') + ' → ABC, A-C',
        ],
        [
          C('\\d') + ' / ' + C('\\D'),
          L('un chiffre / tout sauf un chiffre', 'a digit / anything but a digit'),
          C('"\\d\\d"') + ' → 42',
        ],
        [
          C('\\w') + ' / ' + C('\\W'),
          L('lettre, chiffre ou _ / le contraire', 'letter, digit or _ / the opposite'),
          C('"\\w+"') + L(' → un mot', ' → a word'),
        ],
        [
          C('\\s') + ' / ' + C('\\S'),
          L('un espace (espace, tabulation…) / le contraire', 'whitespace (space, tab…) / the opposite'),
          C('"\\s+"'),
        ],
        [
          C('[aeiou]'),
          L('un caractère de la liste', 'one character from the list'),
          L('une voyelle', 'a vowel'),
        ],
        [
          C('[A-Z0-9]'),
          L("un caractère d'un intervalle", 'one character from a range'),
          L('majuscule ou chiffre', 'capital letter or digit'),
        ],
        [
          C('[^0-9]'),
          L('tout caractère <b>hors</b> de la liste', 'any character <b>not</b> in the list'),
          L('équivaut à ', 'same as ') + C('\\D'),
        ],
      ],
    )}
    <p>${L(
      `Pour chercher un caractère spécial tel quel, précédez-le d'un antislash : ${['\\.', '\\(', '\\$', '\\?', '\\+', '\\*', '\\[', '\\\\'].map(C).join(' ')}. Dans une formule Excel, le guillemet se double : ${C('"\\d+"""')} cherche des chiffres suivis d'un guillemet.`,
      `To search for a special character literally, put a backslash before it: ${['\\.', '\\(', '\\$', '\\?', '\\+', '\\*', '\\[', '\\\\'].map(C).join(' ')}. In an Excel formula, a quotation mark is doubled: ${C('"\\d+"""')} finds digits followed by a quotation mark.`,
    )}</p>
  </section>

  <section>
    <h3>${L('3. Quantificateurs', '3. Quantifiers')}</h3>
    ${table(
      [L('Motif', 'Pattern'), L('Nombre de répétitions', 'Number of repetitions')],
      [
        [C('*'), L('0 ou plus', '0 or more')],
        [C('+'), L('1 ou plus', '1 or more')],
        [C('?'), L('0 ou 1 (facultatif) : ', '0 or 1 (optional): ') + C('colou?r') + ' → color, colour'],
        [C('{4}'), L('exactement 4 : ', 'exactly 4: ') + C('\\d{4}') + L(' → une année', ' → a year')],
        [C('{2,}') + ' / ' + C('{3,5}'), L('au moins 2 / entre 3 et 5', 'at least 2 / between 3 and 5')],
      ],
    )}
    <p>${L(
      `Par défaut un quantificateur est <b>gourmand</b> : il prend le plus possible. Ajoutez ${C('?')} pour le rendre <b>paresseux</b>. Sur ${C('<b>Win</b> and <b>Lose</b>')}, ${C('<b>.*</b>')} prend toute la ligne, alors que ${C('<b>.*?</b>')} s'arrête à la première balise fermante.`,
      `By default a quantifier is <b>greedy</b>: it takes as much as possible. Add ${C('?')} to make it <b>lazy</b>. On ${C('<b>Win</b> and <b>Lose</b>')}, ${C('<b>.*</b>')} takes the whole line, whereas ${C('<b>.*?</b>')} stops at the first closing tag.`,
    )}</p>
  </section>

  <section>
    <h3>${L('4. Ancres et limites', '4. Anchors and boundaries')}</h3>
    <p>${L(
      `${C('^')} = début du texte, ${C('$')} = fin du texte, ${C('\\b')} = limite de mot. Comme ${RT} cherche n'importe où, il faut ancrer pour valider une cellule entière :`,
      `${C('^')} = start of the text, ${C('$')} = end of the text, ${C('\\b')} = word boundary. Because ${RT} searches anywhere, anchor the pattern to validate a whole cell:`,
    )}</p>
    ${pre([
      [
        '=REGEXTEST(A2,"\\d{5}")',
        L(
          `${T} pour "ABC123456" (5 chiffres trouvés quelque part)`,
          `${T} for "ABC123456" (5 digits found somewhere)`,
        ),
      ],
      [
        '=REGEXTEST(A2,"^\\d{5}$")',
        L(
          `${T} uniquement si la cellule contient exactement 5 chiffres`,
          `${T} only if the cell contains exactly 5 digits`,
        ),
      ],
    ])}
  </section>

  <section>
    <h3>${L('5. Groupes, alternatives et remplacements', '5. Groups, alternatives and replacements')}</h3>
    <p>${L(
      `${C('(…)')} capture une partie, ${C('(?:…)')} groupe sans capturer, ${C('a|b')} = a ou b, ${C('\\1')} répète ce que le groupe 1 a trouvé.`,
      `${C('(…)')} captures a part, ${C('(?:…)')} groups without capturing, ${C('a|b')} = a or b, ${C('\\1')} repeats what group 1 found.`,
    )}</p>
    ${pre([
      ['=REGEXEXTRACT("2026-10-25","(\\d{4})-(\\d{2})-(\\d{2})",2)', '2026 | 10 | 25'],
      ['=REGEXREPLACE("Smith, Anna","(\\w+), (\\w+)","$2 $1")', 'Anna Smith'],
      ['=REGEXTEST(A2,"^(?:INV|CR)-\\d+$")', L('codes INV-… ou CR-…', 'INV-… or CR-… codes')],
      ['=REGEXTEST(A2,"\\b(\\w+) \\1\\b")', L('mot répété : "the the"', 'repeated word: "the the"')],
    ])}
  </section>

  <section>
    <h3>${L('6. Anticipation et rétrospection (lookarounds)', '6. Lookahead and lookbehind (lookarounds)')}</h3>
    <p>${L('Ils vérifient ce qui entoure la correspondance sans le capturer.', 'They check what surrounds the match without capturing it.')}</p>
    ${table(
      [L('Motif', 'Pattern'), L('Sens', 'Meaning'), L('Exemple', 'Example')],
      [
        [
          C('X(?=Y)'),
          L('X suivi de Y', 'X followed by Y'),
          C('\\d(?=\\d{4})') + L(' : chiffres sauf les 4 derniers', ': digits except the last 4'),
        ],
        [C('X(?!Y)'), L('X non suivi de Y', 'X not followed by Y'), C('\\bINV(?!-0)')],
        [
          C('(?<=Y)X'),
          L('X précédé de Y', 'X preceded by Y'),
          C('(?<=\\$)\\d+') + L(' : le montant après $', ': the amount after $'),
        ],
        [C('(?<!Y)X'), L('X non précédé de Y', 'X not preceded by Y'), C('(?<!-)\\b\\d+')],
      ],
    )}
    ${pre([
      ['=REGEXREPLACE("4111222233334444","\\d(?=\\d{4})","*")', '************4444'],
      [
        '=REGEXTEST(A2,"^(?=.*\\d)(?=.*[A-Z]).{8,}$")',
        L(
          'mot de passe : 8+ caractères, un chiffre, une majuscule',
          'password: 8+ characters, one digit, one capital',
        ),
      ],
    ])}
  </section>

  <section>
    <h3>${L("7. Recettes pour l'Excel esports", '7. Recipes for Excel esports')}</h3>
    ${table(
      [L('Besoin', 'Need'), L('Formule', 'Formula')],
      [
        [
          L('Tous les nombres (décimaux compris)', 'All numbers (decimals included)'),
          X('=REGEXEXTRACT(A2,"\\d+(?:\\.\\d+)?",1)'),
        ],
        [
          L("Somme des nombres d'un texte", 'Sum of the numbers in a text'),
          X('=SUM(--REGEXEXTRACT(A2,"\\d+",1))'),
        ],
        [L('Garder les chiffres', 'Keep the digits'), X('=REGEXREPLACE(A2,"\\D","")')],
        [L('Espaces multiples → un seul', 'Multiple spaces → one'), X('=REGEXREPLACE(A2,"\\s{2,}"," ")')],
        [L('Texte entre parenthèses', 'Text in parentheses'), X('=REGEXEXTRACT(A2,"\\(([^)]*)\\)",2)')],
        [
          L('Premier mot / dernier mot', 'First word / last word'),
          X('=REGEXEXTRACT(A2,"^\\S+")') + ' · ' + X('=REGEXEXTRACT(A2,"\\S+$")'),
        ],
        [
          L('Filtrer les lignes qui correspondent', 'Filter the matching rows'),
          X('=FILTER(A2:C100,REGEXTEST(B2:B100,"^[A-Z]{2}-\\d+$"))'),
        ],
        [
          L('Compter les correspondances dans une cellule', 'Count the matches in a cell'),
          X('=IFERROR(COLUMNS(REGEXEXTRACT(A2,"[aeiou]",1,1)),0)'),
        ],
        [
          L('Appliquer le mode 1 ou 2 à chaque cellule', 'Apply mode 1 or 2 to each cell'),
          X('=MAP(A2:A10,LAMBDA(t,TEXTJOIN(",",,REGEXEXTRACT(t,"\\d+",1))))'),
        ],
      ],
    )}
  </section>

  <section>
    <h3>${L('8. Pièges fréquents', '8. Common pitfalls')}</h3>
    <p>${L(
      `Oublier ${C('^')} et ${C('$')} quand on valide une cellule entière. Oublier d'échapper le point (${C('\\.')}) dans une adresse ou une extension de fichier. Comparer le résultat texte de ${RE} à un nombre sans le convertir. Oublier qu'une extraction sans correspondance renvoie ${C('#N/A')} : enveloppez avec ${C(fnName('IFERROR'))} ou ${C(fnName('IFNA'))}.`,
      `Forgetting ${C('^')} and ${C('$')} when validating a whole cell. Forgetting to escape the dot (${C('\\.')}) in an address or a file extension. Comparing the text result of ${RE} with a number without converting it. Forgetting that an extraction with no match returns ${C('#N/A')}: wrap it in ${C(fnName('IFERROR'))} or ${C(fnName('IFNA'))}.`,
    )}</p>
    <p>${L(
      `Ce site teste vos motifs avec le moteur du navigateur (JavaScript). Pour la syntaxe de ce cours, il se comporte comme PCRE2 dans Excel ; le préfixe ${C('(?i)')} est accepté en début de motif. Les constructions propres à PCRE2 (groupes atomiques, quantificateurs possessifs, ${C('\\A')}, ${C('\\z')}) ne sont pas reconnues ici.`,
      `This site tests your patterns with the browser's engine (JavaScript). For the syntax in this course it behaves like PCRE2 in Excel; the ${C('(?i)')} prefix is accepted at the start of a pattern. PCRE2-only constructs (atomic groups, possessive quantifiers, ${C('\\A')}, ${C('\\z')}) are not recognised here.`,
    )}</p>
  </section>

  <div class="controls"><button class="btn" data-goto="testeur">${esc(t('regex.openTester'))}</button><button class="btn primary" data-goto="train">${esc(t('regex.train'))}</button></div>
</div>`;
}
