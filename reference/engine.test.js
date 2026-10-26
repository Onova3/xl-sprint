// Tests de référence du moteur (Node) : node reference/engine.test.js
// À porter en Vitest. Toutes les solutions de chaque exercice doivent donner le même résultat que la 1re.
const { runFormula, sameResult, sheetFromRows } = require('./engine.js');
const fs = require('fs'), path = require('path');
const load = f => JSON.parse(fs.readFileSync(path.join(__dirname, '../data/exercises', f), 'utf8')).items;
let bad = 0, n = 0;
for (const ex of [...load('formula-eval.dynamic-arrays.json'), ...load('formula-eval.regex.json')]) {
  const sh = sheetFromRows(ex.sheet), ref = runFormula(ex.solutions[0], sh);
  if (!ref.ok) { bad++; console.log('REF FAIL', ex.id, ref.msg); continue; }
  for (const s of ex.solutions) { n++; const r = runFormula(s, sh); if (!r.ok || !sameResult(ref.value, r.value)) { bad++; console.log('MISMATCH', ex.id, s); } }
}
for (const p of load('regex-patterns.json')) { n++; const re = new RegExp(p.solution); if (!p.yes.every(x => re.test(x)) || p.no.some(x => re.test(x))) { bad++; console.log('PATTERN', p.id); } }
const cases = [['=1+2*3^2', 19], ['=-2^2', 4], ['=LET(f,LAMBDA(x,x*2),f(21))', 42], ['=ROUND(-2.5,0)', -3], ['=MOD(-3,2)', 1]];
for (const [f, v] of cases) { n++; const r = runFormula(f, {}); if (!r.ok || r.value !== v) { bad++; console.log('CASE', f, r.value); } }
n++; if (runFormula('=MAKEARRAY(2,2,LAMBDA(r,c,r*c))', {}).ok) { bad++; console.log('r/c should be rejected'); }
console.log(`${n} vérifications, ${bad} échec(s)`);
process.exit(bad ? 1 : 0);
