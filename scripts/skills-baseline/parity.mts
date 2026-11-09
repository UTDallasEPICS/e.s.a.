import {execFileSync} from 'node:child_process'
import {tfidfScores} from '../../server/utils/skillFit.ts'

const students = {s1: 'Python, React, SQL', s2: 'C++, C#, Node.js', s3: '', s4: 'Welding, CAD, python'}
const projects = {pA: 'Python, SQL, Flask', pB: 'C#, .NET, Node.js', pC: ''}

const py = `
import json, sys
sys.path.insert(0, 'server/services/CPSAT')
from skill_match import tfidf_scores
d = json.load(sys.stdin)
r = tfidf_scores(d['students'], d['projects'])
print(json.dumps({f'{s}|{p}': v for (s, p), v in r.items()}))
`
const python = execFileSync('python3', ['-c', py], {input: JSON.stringify({students, projects})}).toString()
const expected: Record<string, number> = JSON.parse(python)
const got = tfidfScores(students, projects)

let worst = 0
for (const [k, v] of Object.entries(expected)) worst = Math.max(worst, Math.abs(v - (got.get(k) ?? NaN)))
console.log(`${got.size} pairs compared, largest difference ${worst}`)
if (!(worst < 1e-9) || got.size !== Object.keys(expected).length) {
  console.error('MISMATCH between skillFit.ts and skill_match.py')
  process.exit(1)
}
console.log('OK: TypeScript and Python TF-IDF agree')
