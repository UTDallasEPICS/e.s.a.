import unittest
from benchmark import evaluate, fingerprint, skills


class BenchmarkTests(unittest.TestCase):
    def test_aliases_and_languages(self):
        self.assertEqual(skills({'skills': ['JS', 'C++', 'C#']}), {'javascript', 'c++', 'c#'})

    def test_fingerprint_changes_with_input(self):
        a = fingerprint({'skills': 'SQL'}, {'skills': 'SQL'})[0]
        b = fingerprint({'skills': 'React'}, {'skills': 'SQL'})[0]
        self.assertNotEqual(a, b)

    def test_ranking_and_missing_exclusion(self):
        labels = [{'student_id': 'a', 'project_id': 'p', 'rating': 3},
                  {'student_id': 'b', 'project_id': 'p', 'rating': 0}]
        rows = [{'student_id': 'a', 'project_id': 'p', 'score': .8, 'missing_skills': False},
                {'student_id': 'b', 'project_id': 'p', 'score': .2, 'missing_skills': False}]
        self.assertEqual(evaluate(rows, labels)['pairwise_agreement'], 1)
        rows[0]['missing_skills'] = True
        self.assertIsNone(evaluate(rows, labels)['pairwise_agreement'])


class CommandLineTests(unittest.TestCase):
    def run_benchmark(self, directory, data, methods, replay=None):
        import json
        import subprocess
        import sys
        from pathlib import Path
        root = Path(directory)
        source = root / 'input.json'
        source.write_text(json.dumps(data))
        command = [sys.executable, str(Path(__file__).with_name('benchmark.py')),
                   str(source), '--output-dir', str(root / 'output'), '--methods', *methods]
        if replay is not None:
            saved = root / 'replay.json'
            saved.write_text(json.dumps(replay))
            command += ['--replay', str(saved)]
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads((root / 'output' / 'report.json').read_text())

    def test_lexical_reports_and_unavailable_models(self):
        import tempfile
        data = {'students': [{'id': 's', 'skills': 'SQL'}],
                'projects': [{'id': 'p', 'skills': 'SQL'}]}
        with tempfile.TemporaryDirectory() as directory:
            report = self.run_benchmark(directory, data,
                                        ['tfidf', 'coverage', 'jaccard', 'char-tfidf', 'minilm', 'jev'])
        for method in ['tfidf', 'coverage', 'jaccard', 'char-tfidf']:
            self.assertEqual(report['methods'][method]['status'], 'ok')
            self.assertIsNone(report['methods'][method]['pairwise_agreement'])
        for method in ['minilm', 'jev']:
            self.assertEqual(report['methods'][method]['status'], 'unavailable')

    def test_replay_accepts_matching_and_rejects_stale_data(self):
        import tempfile
        student, project = {'id': 's', 'skills': 'SQL'}, {'id': 'p', 'skills': 'SQL'}
        data = {'students': [student], 'projects': [project]}
        replay = [{'method': 'jev', 'student_id': 's', 'project_id': 'p',
                   'fingerprint': fingerprint(student, project)[0], 'score': 3,
                   'model': 'fixture-contract-only', 'source': 'live'}]
        # Fabricated fixture tests the contract only; never used as quality evidence.
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(self.run_benchmark(directory, data, ['jev'], replay)
                             ['methods']['jev']['status'], 'ok')
            replay[0]['fingerprint'] = 'stale'
            self.assertEqual(self.run_benchmark(directory, data, ['jev'], replay)
                             ['methods']['jev']['status'], 'unavailable')
