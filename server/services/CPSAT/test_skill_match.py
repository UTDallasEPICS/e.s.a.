import sys, types, unittest

from skill_match import tokenize, tfidf_scores, skill_fit_table, clamp01


class SkillMatchTests(unittest.TestCase):
    def test_tokenize_keeps_technical_names(self):
        self.assertEqual(tokenize('C++, C#, Node.js'), ['c++', 'c#', 'node.js'])

    def test_overlap_scores_higher_than_none(self):
        scores = tfidf_scores({'a': 'Python, SQL', 'b': 'Welding, CAD'}, {'p': 'Python, SQL, Flask'})
        self.assertGreater(scores[('a', 'p')], 0.5)
        self.assertEqual(scores[('b', 'p')], 0.0)

    def test_missing_skills_score_zero(self):
        scores = tfidf_scores({'a': ''}, {'p': 'Python'})
        self.assertEqual(scores[('a', 'p')], 0.0)
        scores = tfidf_scores({'a': 'Python'}, {'p': ''})
        self.assertEqual(scores[('a', 'p')], 0.0)

    def test_deterministic(self):
        a = tfidf_scores({'a': 'React, TypeScript'}, {'p': 'React, Node.js'})
        b = tfidf_scores({'a': 'React, TypeScript'}, {'p': 'React, Node.js'})
        self.assertEqual(a, b)

    def test_provided_scores_override_local(self):
        table = skill_fit_table(
            [{'id': 's1', 'skills': 'Python', 'skillScores': {'P': 0.25}}, {'id': 's2', 'skills': 'Python'}],
            [{'name': 'P', 'skills': 'Python'}])
        self.assertEqual(table['s1']['P'], 0.25)
        self.assertGreater(table['s2']['P'], 0.9)

    def test_clamp(self):
        self.assertEqual(clamp01(7), 1.0)
        self.assertEqual(clamp01(-1), 0.0)
        self.assertEqual(clamp01('x'), 0.0)
        self.assertEqual(clamp01(float('nan')), 0.0)


class TieBreakPointsTests(unittest.TestCase):
    """The tie-break helpers live in team_generator.py, which imports ortools; stub it so this
    runs without the solver installed. Experience vs skill fit ordering is enforced by solving
    in stages (see test_tie_break.py), not by these point values."""

    @classmethod
    def setUpClass(cls):
        try:
            import ortools  # noqa: F401
        except ImportError:
            for name in ('ortools', 'ortools.sat', 'ortools.sat.python'):
                sys.modules[name] = types.ModuleType(name)
            sys.modules['ortools.sat.python'].cp_model = types.SimpleNamespace(CpModel=object)
        import team_generator
        cls.exp = staticmethod(team_generator.experience_points)
        cls.fit = staticmethod(team_generator.fit_points)

    def test_3200_experience_beats_semesters(self):
        self.assertGreater(self.exp({'prior3200Semesters': 1, 'priorSemesters': 1}, 0),
                           self.exp({'priorSemesters': 9}, 0))

    def test_more_semesters_score_higher(self):
        self.assertGreater(self.exp({'priorSemesters': 3}, 0), self.exp({'priorSemesters': 2}, 0))

    def test_better_fit_scores_higher(self):
        self.assertGreater(self.fit(0.8, 0), self.fit(0.3, 0))

    def test_lower_choices_weigh_less_and_unranked_is_zero(self):
        s = {'priorSemesters': 2}
        self.assertGreater(self.exp(s, 0), self.exp(s, 3))
        self.assertGreater(self.fit(0.5, 0), self.fit(0.5, 3))
        self.assertEqual(self.exp(s, 6), 0)
        self.assertEqual(self.fit(1.0, 6), 0)


if __name__ == '__main__':
    unittest.main()
