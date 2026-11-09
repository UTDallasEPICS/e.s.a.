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
    """tie_break_points lives in team_generator.py, which imports ortools; stub it so this
    runs without the solver installed."""

    @classmethod
    def setUpClass(cls):
        try:
            import ortools  # noqa: F401
        except ImportError:
            for name in ('ortools', 'ortools.sat', 'ortools.sat.python'):
                sys.modules[name] = types.ModuleType(name)
            sys.modules['ortools.sat.python'].cp_model = types.SimpleNamespace()
        import team_generator
        cls.tb = staticmethod(team_generator.tie_break_points)

    def test_experience_beats_any_skill_fit(self):
        best_fit_no_extra_semester = self.tb({'priorSemesters': 1}, 0, 1.0)
        one_more_semester_no_fit = self.tb({'priorSemesters': 2}, 0, 0.0)
        self.assertGreater(one_more_semester_no_fit, best_fit_no_extra_semester)

    def test_3200_experience_beats_semesters(self):
        self.assertGreater(self.tb({'prior3200Semesters': 1, 'priorSemesters': 1}, 0),
                           self.tb({'priorSemesters': 9}, 0))

    def test_skill_fit_breaks_equal_experience(self):
        s = {'priorSemesters': 2}
        self.assertGreater(self.tb(s, 0, 0.8), self.tb(s, 0, 0.3))

    def test_lower_choices_weigh_less_and_unranked_is_zero(self):
        s = {'priorSemesters': 2}
        self.assertGreater(self.tb(s, 0, 0.5), self.tb(s, 3, 0.5))
        self.assertEqual(self.tb(s, 6, 1.0), 0)


if __name__ == '__main__':
    unittest.main()
