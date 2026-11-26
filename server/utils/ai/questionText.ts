/**
 * Purpose
 * Provide the question text logic used by other parts of ESA.
 *
 * Inputs
 * - Values passed by callers and any configuration or records imported here.
 *
 * Outputs
 * - The values, types, or functions exported by this file.
 *
 * Pseudocode
 * Load the dependencies → define the file’s rules or helpers → expose them for other files to use.
 */
// Correct common command words only; never fuzzy-rewrite names or record values.
export function normalizeQuestionText(question: string): string {
  // Define corrections for the steps below.
  const corrections: Record<string, string> = {
    sanky: 'sankey', sankye: 'sankey', sankeyy: 'sankey', saneky: 'sankey',
    graoh: 'graph', graohs: 'graphs', grpah: 'graph', grpahs: 'graphs', grapf: 'graph',
    studnets: 'students', studens: 'students', studetns: 'students',
    projcts: 'projects', proejcts: 'projects', proects: 'projects',
    semestr: 'semester', semster: 'semester', semseter: 'semester',
    sprng: 'spring', sprin: 'spring', sprign: 'spring', fal: 'fall', faal: 'fall', flal: 'fall', falll: 'fall', summr: 'summer', sumemr: 'summer',
    shwo: 'show', coutn: 'count', compar: 'compare', comapre: 'compare', compair: 'compare', demograpics: 'demographics', demogrpahics: 'demographics', majros: 'majors', majrs: 'majors', majoers: 'majors',
  }
  // Update question with the value on the right.
  question=question.normalize('NFKC').replace(/\b(sprng|sprign|sprin|spring|flal|falll|faal|fal|fall|summr|sumemr|summer)\s*[-']?(20\d{2}|\d{2})\b/gi,(_,term:string,year:string)=>`${corrections[term.toLowerCase()]??term} ${year}`).replace(/\b(20\d{2})\s*(sprng|sprign|sprin|spring|flal|falll|faal|fal|fall|summr|sumemr|summer)\b/gi,(_,year:string,term:string)=>`${year} ${corrections[term.toLowerCase()]??term}`)
  // Pass question.replace(/\b[a-z]+\b/gi, word => corrections[word.toLowerCase()] ?? word) .replace(/\s+/g, ' back to the caller.
  return question.replace(/\b[a-z]+\b/gi, word => corrections[word.toLowerCase()] ?? word)
    .replace(/\s+/g, ' ').trim()
}
