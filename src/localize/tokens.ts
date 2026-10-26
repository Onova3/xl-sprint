/* Découpage sans perte d'une formule en jetons, pour la traduire.
   Concaténer les `text` redonne exactement l'entrée. */

export type LTokKind = 'str' | 'bracket' | 'quoted' | 'num' | 'id' | 'open' | 'close' | 'sep' | 'other';
export interface LTok {
  kind: LTokKind;
  text: string;
  /** Profondeur d'accolades : > 0 dans une constante de tableau. */
  inArray: boolean;
}

export interface LexSyntax {
  decimalSep: string;
  /** Caractères qui séparent des éléments (hors chaînes) dans cette syntaxe. */
  listSep: string;
  arrayColSep: string;
  arrayRowSep: string;
}

const ID_START = /[\p{L}_\\]/u;
const ID_CHAR = /[\p{L}\p{N}_.]/u;
const ID_CHAR_NO_DOT = /[\p{L}\p{N}_]/u;

export function lex(src: string, syn: LexSyntax): LTok[] {
  const out: LTok[] = [];
  let i = 0,
    depth = 0;
  const push = (kind: LTokKind, text: string) => out.push({ kind, text, inArray: depth > 0 });
  const prevIsWordChar = () => {
    const p = out[out.length - 1];
    return !!p && (p.kind === 'id' || p.kind === 'num') && i > 0 && /[\p{L}\p{N}_.$]/u.test(src[i - 1]);
  };
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '"') {
          if (src[j + 1] === '"') {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      push('str', src.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    if (ch === "'") {
      // nom de feuille entre apostrophes : 'Ma feuille'!A1
      let j = i + 1;
      while (j < src.length && !(src[j] === "'" && src[j + 1] !== "'")) j += src[j] === "'" ? 2 : 1;
      push('quoted', src.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    if (ch === '[') {
      // référence structurée : laissée telle quelle (crochets imbriqués)
      let j = i,
        d = 0;
      do {
        if (src[j] === '[') d++;
        else if (src[j] === ']') d--;
        j++;
      } while (j < src.length && d > 0);
      push('bracket', src.slice(i, j));
      i = j;
      continue;
    }
    if (/\d/.test(ch)) {
      if (!prevIsWordChar()) {
        const d = syn.decimalSep === '.' ? '\\.' : syn.decimalSep;
        const m = new RegExp(`^\\d+(?:${d}\\d+)?(?:[eE][+-]?\\d+)?`).exec(src.slice(i)) as RegExpExecArray;
        // « 1,5 » n'est un nombre que si la virgule n'est pas aussi un séparateur actif ici
        let text = m[0];
        const sepsHere = depth > 0 ? [syn.arrayColSep, syn.arrayRowSep] : [syn.listSep];
        if (sepsHere.includes(syn.decimalSep)) text = /^\d+/.exec(text)![0];
        push('num', text);
        i += text.length;
        continue;
      }
    }
    if (ID_START.test(ch) || (ch === '$' && /[\p{L}]/u.test(src[i + 1] ?? ''))) {
      let j = i + 1;
      const idChar = depth > 0 && syn.arrayRowSep === '.' ? ID_CHAR_NO_DOT : ID_CHAR;
      while (j < src.length && (idChar.test(src[j]) || src[j] === '$')) j++;
      push('id', src.slice(i, j));
      i = j;
      continue;
    }
    if (ch === '{') {
      push('open', ch);
      depth++;
      i++;
      continue;
    }
    if (ch === '}') {
      depth = Math.max(0, depth - 1);
      push('close', ch);
      i++;
      continue;
    }
    const isSep = depth > 0 ? ch === syn.arrayColSep || ch === syn.arrayRowSep : ch === syn.listSep;
    push(isSep ? 'sep' : 'other', ch);
    i++;
  }
  return out;
}
