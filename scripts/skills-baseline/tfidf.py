"""Offline student/project skill similarity using only the Python standard library."""
import argparse
import csv
import json
import math
import re
from collections import Counter
from pathlib import Path


def tokenize(text):
    # Keep punctuation meaningful in technical names: C++, C#, Node.js, .NET.
    return re.findall(r"\.?[a-z0-9]+(?:[.+#-][a-z0-9]+)*(?:\+\+|#)?", text.lower())


def skill_text(value):
    if isinstance(value, str):
        return value
    if isinstance(value, list) and all(isinstance(item, str) for item in value):
        return ", ".join(value)
    raise ValueError("skills must be a string or a list of strings")


def validate_records(records):
    if not isinstance(records, list):
        raise ValueError("students and projects must be arrays")
    ids = set()
    for record in records:
        if not isinstance(record, dict) or not isinstance(record.get("id"), str):
            raise ValueError("each record needs a string id")
        if not record["id"] or record["id"] in ids:
            raise ValueError("record ids must be nonempty and unique within each collection")
        ids.add(record["id"])
        skill_text(record.get("skills", ""))


def score_pairs(students, projects):
    validate_records(students)
    validate_records(projects)
    documents = [Counter(tokenize(skill_text(r.get("skills", ""))))
                 for r in students + projects]
    frequency = Counter(term for document in documents for term in document)
    count = len(documents)
    idf = {term: math.log((1 + count) / (1 + df)) + 1
           for term, df in frequency.items()}
    vectors = []
    for document in documents:
        weights = {term: tf * idf[term] for term, tf in document.items()}
        norm = math.sqrt(sum(weight ** 2 for weight in weights.values()))
        vectors.append({term: weight / norm for term, weight in weights.items()} if norm else {})
    rows = []
    for i, student in enumerate(students):
        for j, project in enumerate(projects):
            left, right = vectors[i], vectors[len(students) + j]
            score = min(1.0, sum(weight * right.get(term, 0) for term, weight in left.items()))
            rows.append({"student_id": student["id"], "project_id": project["id"],
                         "cosine_similarity": round(score, 8),
                         "shared_terms": "; ".join(sorted(left.keys() & right.keys())),
                         "missing_skills": not left or not right})
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="JSON containing students and projects")
    parser.add_argument("--output", type=Path, required=True, help="Output CSV path")
    args = parser.parse_args()
    try:
        data = json.loads(args.input.read_text())
        rows = score_pairs(data["students"], data["projects"])
    except (ValueError, KeyError, TypeError) as exc:
        parser.error(str(exc))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=["student_id", "project_id", "cosine_similarity",
                                                   "shared_terms", "missing_skills"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} student-project scores to {args.output}")


if __name__ == "__main__":
    main()
