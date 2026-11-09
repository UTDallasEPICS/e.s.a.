// TypeScript twin of server/services/CPSAT/skill_match.py (tfidf_scores). The solver uses the
// Python one; this copy lets the tie-break report show the same numbers without spawning Python.
// Keep the two in step: scripts/skills-baseline/check_parity.sh compares them on sample data.

const TOKEN = /\.?[a-z0-9]+(?:[.+#-][a-z0-9]+)*(?:\+\+|#)?/g

export function tokenize(text: string | null | undefined): string[] {
  return (text ?? '').toLowerCase().match(TOKEN) ?? []
}

/** {studentId: skills} x {projectId: skills} -> Map of `${studentId}|${projectId}` -> cosine 0..1 */
export function tfidfScores(
  students: Record<string, string>,
  projects: Record<string, string>
): Map<string, number> {
  const docs: Array<{kind: 's' | 'p'; id: string; counts: Map<string, number>}> = []
  const add = (kind: 's' | 'p', id: string, text: string) => {
    const counts = new Map<string, number>()
    for (const t of tokenize(text)) counts.set(t, (counts.get(t) ?? 0) + 1)
    docs.push({kind, id, counts})
  }
  for (const [id, text] of Object.entries(students)) add('s', id, text)
  for (const [id, text] of Object.entries(projects)) add('p', id, text)

  const df = new Map<string, number>()
  for (const d of docs) for (const t of d.counts.keys()) df.set(t, (df.get(t) ?? 0) + 1)
  const n = docs.length
  const idf = (t: string) => Math.log((1 + n) / (1 + df.get(t)!)) + 1

  const vectors = new Map<string, Map<string, number>>()
  for (const d of docs) {
    const w = new Map<string, number>()
    let sumSq = 0
    for (const [t, tf] of d.counts) {
      const v = tf * idf(t)
      w.set(t, v)
      sumSq += v * v
    }
    const norm = Math.sqrt(sumSq)
    vectors.set(`${d.kind}|${d.id}`, new Map([...w].map(([t, v]) => [t, norm ? v / norm : 0])))
  }

  const out = new Map<string, number>()
  for (const sid of Object.keys(students)) {
    const left = vectors.get(`s|${sid}`)!
    for (const pid of Object.keys(projects)) {
      const right = vectors.get(`p|${pid}`)!
      let dot = 0
      for (const [t, v] of left) dot += v * (right.get(t) ?? 0)
      out.set(`${sid}|${pid}`, Math.min(1, dot))
    }
  }
  return out
}
