"""Offline benchmark: lexical methods, optional cached local models, API replay."""
import argparse
import hashlib
import itertools
import json
import math
import os
import re
import time
from collections import Counter
from pathlib import Path

from tfidf import score_pairs, skill_text, validate_records, tokenize

MODELS = {
    'minilm': 'sentence-transformers/all-MiniLM-L6-v2',
    'mpnet': 'sentence-transformers/all-mpnet-base-v2',
    'bge': 'BAAI/bge-small-en-v1.5',
    'e5': 'intfloat/e5-small-v2',
    'qwen': 'Qwen/Qwen3-Embedding-0.6B',
}
ALIASES = {'js': 'javascript', 'react.js': 'react', 'reactjs': 'react',
           'nodejs': 'node.js', 'py': 'python', 'postgres': 'postgresql'}
RUBRIC = [
    'No relevant skills evidenced.',
    'Related skills, but little direct coverage of requirements.',
    'Direct coverage of some requirements, with substantial gaps.',
    'Direct coverage of most or all requirements.',
]
INSTRUCTION = 'Judge coverage of project skills using only stated student skills. Do not infer unstated proficiency.'


def skills(record):
    value = record.get('skills', '')
    values = value if isinstance(value, list) else re.split(r'[,;\n]', value)
    return {ALIASES.get(v.strip().lower(), v.strip().lower()) for v in values if v.strip()}


def fingerprint(student, project):
    payload = {'student_skills': skill_text(student.get('skills', '')),
               'project_skills': skill_text(project.get('skills', '')),
               'rubric': RUBRIC, 'instructions': INSTRUCTION}
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest(), payload


def char_scores(records):
    docs = []
    for record in records:
        text = ' ' + skill_text(record.get('skills', '')).lower() + ' '
        docs.append(Counter(text[i:i+n] for n in (3, 4, 5)
                            for i in range(len(text)-n+1)))
    df = Counter(k for d in docs for k in d)
    vectors = []
    for d in docs:
        w = {k: v * (math.log((1+len(docs))/(1+df[k]))+1) for k, v in d.items()}
        norm = math.sqrt(sum(v*v for v in w.values()))
        vectors.append({k: v/norm for k, v in w.items()} if norm else {})
    return vectors


def evaluate(rows, labels):
    lookup = {(r['student_id'], r['project_id']): r for r in rows}
    usable = [(label, lookup[(label['student_id'], label['project_id'])]) for label in labels
              if (label['student_id'], label['project_id']) in lookup
              and not lookup[(label['student_id'], label['project_id'])]['missing_skills']]
    # Only compare students for the same project; ignore human ties.
    comparisons = [(a, b) for a, b in itertools.combinations(usable, 2)
                   if a[0]['project_id'] == b[0]['project_id'] and a[0]['rating'] != b[0]['rating']]
    agreement = []
    for (la, ra), (lb, rb) in comparisons:
        delta = ra['score'] - rb['score']
        agreement.append(0.5 if abs(delta) < 1e-9 else float(delta * (la['rating']-lb['rating']) > 0))
    return {'labeled_pairs': len(usable), 'ranking_comparisons': len(agreement),
            'pairwise_agreement': sum(agreement)/len(agreement) if agreement else None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--methods', nargs='+', default=['tfidf', 'coverage', 'jaccard', 'char-tfidf'],
                        choices=['tfidf', 'coverage', 'jaccard', 'char-tfidf', *MODELS, 'gemini', 'jev'])
    parser.add_argument('--model-paths', type=Path, help='JSON mapping model aliases to local model directories')
    parser.add_argument('--replay', type=Path, help='Saved API responses JSON; no live API support')
    args = parser.parse_args()
    data = json.loads(args.input.read_text())
    students, projects = data['students'], data['projects']
    validate_records(students)
    validate_records(projects)
    if not students or not projects:
        parser.error('provide at least one student and project')
    pairs = list(itertools.product(range(len(students)), range(len(projects))))
    labels = data.get('labels', [])
    valid_keys = {(s['id'], p['id']) for s in students for p in projects}
    seen = set()
    for label in labels:
        key = (label['student_id'], label['project_id'])
        rating = label['rating']
        if key not in valid_keys or key in seen or isinstance(rating, bool) or not isinstance(rating, (int, float)) or not math.isfinite(rating) or not 0 <= rating <= 3:
            parser.error('labels require unique known pairs and finite ratings from 0 to 3')
        seen.add(key)
    paths = json.loads(args.model_paths.read_text()) if args.model_paths else {}
    replay = json.loads(args.replay.read_text()) if args.replay else []
    args.output_dir.mkdir(parents=True, exist_ok=True)
    requests = []
    for i, j in pairs:
        s, p = students[i], projects[j]
        digest, state = fingerprint(s, p)
        requests.append({'student_id': s['id'], 'project_id': p['id'], 'fingerprint': digest,
                         'state': state, 'jev_question': {'type': 'score', 'instructions': INSTRUCTION, 'criteria': RUBRIC}})
    (args.output_dir/'requests.json').write_text(json.dumps(requests, indent=2)+'\n')
    summaries, all_rows = {}, []
    for method in dict.fromkeys(args.methods):
        started = time.perf_counter()
        try:
            scores = []
            metadata = {}
            if method == 'tfidf':
                scores = [r['cosine_similarity'] for r in score_pairs(students, projects)]
            elif method in ('coverage', 'jaccard'):
                for i, j in pairs:
                    left, right = skills(students[i]), skills(projects[j])
                    denominator = right if method == 'coverage' else left | right
                    scores.append(len(left & right)/len(denominator) if denominator else 0)
            elif method == 'char-tfidf':
                vectors = char_scores(students + projects)
                scores = [sum(v*vectors[len(students)+j].get(k, 0) for k, v in vectors[i].items()) for i, j in pairs]
            elif method in MODELS:
                # Enforce offline operation, even inside third-party model loading.
                os.environ['HF_HUB_OFFLINE'] = '1'
                os.environ['TRANSFORMERS_OFFLINE'] = '1'
                if method not in paths or not Path(paths[method]).is_dir():
                    raise ValueError('local model directory not configured; no download attempted')
                from sentence_transformers import SentenceTransformer
                model = SentenceTransformer(paths[method], local_files_only=True, trust_remote_code=False, device='cpu')
                texts = [skill_text(r.get('skills', '')) for r in students + projects]
                if method == 'e5':
                    texts = ['query: '+t for t in texts]  # symmetric similarity protocol
                embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
                scores = [float(embeddings[i] @ embeddings[len(students)+j]) for i, j in pairs]
                metadata = {'model': MODELS[method], 'local_path': paths[method], 'device': 'cpu'}
            else:
                saved = {(r['student_id'], r['project_id']): r for r in replay if r['method'] == method}
                for request in requests:
                    row = saved.get((request['student_id'], request['project_id']))
                    if row is None or row.get('fingerprint') != request['fingerprint']:
                        raise ValueError('missing or stale replay response')
                    value = row['score']
                    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 3:
                        raise ValueError('replay score must be a finite rubric score from 0 to 3')
                    if not row.get('model') or row.get('source') != 'live':
                        raise ValueError('replay needs model and source=live; mock predictions are not benchmark evidence')
                    scores.append(value/3)
                metadata = {'mode': 'replay', 'models': sorted({r['model'] for r in saved.values()})}
            rows = []
            for (i, j), score in zip(pairs, scores):
                s, p = students[i], projects[j]
                missing = not tokenize(skill_text(s.get('skills', ''))) or not tokenize(skill_text(p.get('skills', '')))
                rows.append({'method': method, 'student_id': s['id'], 'project_id': p['id'],
                             'score': 0 if missing else score, 'missing_skills': missing})
            all_rows.extend(rows)
            summaries[method] = {'status': 'ok', 'elapsed_seconds': time.perf_counter()-started,
                                 **metadata, **evaluate(rows, labels)}
        except (ImportError, OSError, ValueError, KeyError) as exc:
            summaries[method] = {'status': 'unavailable', 'reason': str(exc)}
    import csv
    with (args.output_dir/'scores.csv').open('w', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=['method', 'student_id', 'project_id', 'score', 'missing_skills'])
        writer.writeheader()
        writer.writerows(all_rows)
    report = {'input_sha256': hashlib.sha256(args.input.read_bytes()).hexdigest(),
              'notes': 'Ranking metrics exclude missing skills. Replay timing is not API latency. No API calls or downloads.',
              'methods': summaries}
    (args.output_dir/'report.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
