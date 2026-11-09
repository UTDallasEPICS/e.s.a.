"""
Skill fit between a student's free-text skills and a project's required skills.

Used only as the LAST level of the tie-break in team_generator.py: it never outranks a
real choice score, 3200 experience, or semester count. Pure standard library (no ortools)
so it can be tested on its own. Fixed rules, no network: the same data always gives the
same score. The TF-IDF is the same method as scripts/skills-baseline/tfidf.py.

A student may carry precomputed `skillScores` ({project name: 0..1}), e.g. from the
optional LLM scorer (server/services/skillFitService.ts). Those override TF-IDF for that
student; everyone else falls back to the local cosine.
"""
import math
import re
from collections import Counter

# Keeps punctuation inside technical names: C++, C#, Node.js, .NET.
_TOKEN = re.compile(r"\.?[a-z0-9]+(?:[.+#-][a-z0-9]+)*(?:\+\+|#)?")


def tokenize(text):
    return _TOKEN.findall((text or '').lower())


def clamp01(value):
    try:
        value = float(value)
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(value):
        return 0.0
    return max(0.0, min(1.0, value))


def tfidf_scores(student_skills, project_skills):
    """
    student_skills / project_skills: {id: skills string}. Returns {(student_id, project_id): cosine}.
    IDF is fitted jointly over every student and project document (smoothed, L2-normalised).
    Pairs where either side has no skills score 0.
    """
    docs = {('s', k): Counter(tokenize(v)) for k, v in student_skills.items()}
    docs.update({('p', k): Counter(tokenize(v)) for k, v in project_skills.items()})
    count = len(docs)
    frequency = Counter(term for doc in docs.values() for term in doc)
    idf = {term: math.log((1 + count) / (1 + df)) + 1 for term, df in frequency.items()}

    vectors = {}
    for key, doc in docs.items():
        weights = {t: tf * idf[t] for t, tf in doc.items()}
        norm = math.sqrt(sum(w * w for w in weights.values()))
        vectors[key] = {t: w / norm for t, w in weights.items()} if norm else {}

    scores = {}
    for sid in student_skills:
        left = vectors[('s', sid)]
        for pid in project_skills:
            right = vectors[('p', pid)]
            scores[(sid, pid)] = min(1.0, sum(w * right.get(t, 0.0) for t, w in left.items()))
    return scores


def skill_fit_table(students, projects):
    """
    students: dicts with id, optional skills, optional skillScores.
    projects: dicts with name, optional skills.
    Returns {student_id: {project_name: fit 0..1}}.
    """
    local = tfidf_scores({s['id']: s.get('skills', '') or '' for s in students},
                         {p['name']: p.get('skills', '') or '' for p in projects})
    table = {}
    for s in students:
        provided = s.get('skillScores') or {}
        row = {}
        for p in projects:
            name = p['name']
            if name in provided:
                row[name] = clamp01(provided[name])
            else:
                row[name] = local[(s['id'], name)]
        table[s['id']] = row
    return table
