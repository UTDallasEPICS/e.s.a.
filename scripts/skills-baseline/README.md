# Local TF-IDF skills baseline

No API keys, network calls, paid services, or additional Python packages are needed.
Run from the repository root:

```sh
python3 scripts/skills-baseline/tfidf.py scripts/skills-baseline/example.json --output data/skills-baseline/example-scores.csv
python3 -m unittest discover -s scripts/skills-baseline -p 'test_*.py'
```

For real inputs, copy the example structure into `data/skills-baseline/input.json`
and replace the input path in the command. `data/` is ignored by Git. Keep real
student data and generated results there; use opaque IDs and skills only.
Projects need manually reviewed skills strings because the database currently
has no dedicated project skills field. Do not substitute full descriptions for
skills in just one method when later comparing methods.

The input has `students` and `projects` arrays. Each record has a unique string
`id` and `skills` as a string or string array. Missing skills become empty text.
The output has one row per student-project pair, a cosine score, shared terms,
and a missing-skills flag. Empty inputs score zero, but are flagged separately
from observed skills with no overlap. Scores are similarities, not probabilities.

The scorer lowercases and tokenizes technical terms, uses raw term frequency,
smoothed IDF `log((1 + document_count) / (1 + document_frequency)) + 1`, and
L2-normalized vectors. IDF is fitted jointly on all supplied student and project
documents. Freeze that corpus for reproducible comparisons; changing it can
change scores. C, C++, and C# remain distinct. Synonyms such as JS/JavaScript
are not expanded. Multiword skills are split into words, so shared generic
words can inflate similarity. Repeated terms also influence the score.

This is a scoring baseline, not yet an accuracy benchmark or a solver change.
Next, have reviewers rate a fixed sample of pairs from 0–3 without seeing the
model scores. Reserve separate students for tuning and evaluation, then compare
rankings and inspect false matches and missing-data cases. Do not interpret
TF-IDF as evidence of proficiency or use it to override project preferences.

## Shared benchmark harness

Run every currently supported method (no network calls or model downloads):

```sh
python3 scripts/skills-baseline/benchmark.py scripts/skills-baseline/example.json --output-dir data/skills-baseline/benchmark --methods tfidf coverage jaccard char-tfidf minilm mpnet bge e5 qwen gemini jev
```

Outputs:
- `scores.csv`: comparable pair IDs and scores for methods that ran.
- `report.json`: per-method status, wall time, and human-label ranking agreement.
- `requests.json`: skill-only inputs, rubric, and fingerprints for future API work.

The included labels are synthetic sanity checks, not evidence of real-world
accuracy. Optional input `labels` contain `student_id`, `project_id`, and a
human `rating` from 0 to 3. Ranking agreement compares differently rated students
for the same project; predicted ties count as half a win. Missing inputs are
excluded. Use a held-out evaluation file once tuning starts. Raw scores across
models are not calibrated or directly comparable. No labels means no quality
metric. Coverage and Jaccard split string skills on commas, semicolons, or
newlines; prefer arrays to preserve multiword skills. Aliases are explicit in
`benchmark.py`; they do not equate C, C++, and C#.

### Optional local models

Install `requirements-local.txt` in a separate virtual environment if desired.
Download model snapshots separately, then provide `--model-paths paths.json`,
where the JSON maps aliases (`minilm`, `mpnet`, `bge`, `e5`, `qwen`) to local
snapshot directories. The harness forces offline CPU inference and disables
remote model code. It never installs packages or fetches weights. Record the
snapshot revision alongside your paths for reproducibility. Timings include
model loading and encoding, not just cosine calculations. Hardware, peak RAM,
and warm-run timing still need separate deployment measurements.

The embedding protocol uses whole skill strings, normalized embeddings and dot
products. E5 gets `query: ` on both sides for symmetric similarity. Other models
use their default encoding without retrieval instructions. This is a fixed
initial protocol, not tuned retrieval performance. Per-requirement embedding
coverage and generative local models are not implemented yet.

### API preparation without keys

There is **no live API mode**. Gemini and Jev only replay real saved responses.
With `--replay responses.json`, supply an array of entries:

```json
[{"method":"jev","student_id":"s1","project_id":"p1",
  "fingerprint":"copy from requests.json","score":2.3,
  "model":"exact-provider-model-version","source":"live"}]
```

Scores must use the shared 0–3 rubric. Each requested pair must have a matching
fingerprint; changed inputs or rubric invalidate replay. Keep provider raw
responses, token usage, probability distributions and confidence alongside
these records for later audits; this initial runner only evaluates the score.
Replay timing measures file processing, not provider latency. Mock predictions
are deliberately rejected as accuracy evidence. This prepares the common data
contract; provider-specific live clients, retries, cost accounting, and
confidence calibration remain future work.
