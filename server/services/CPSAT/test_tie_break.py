import unittest

from team_generator import generate_teams, suggest_upperclass_placements


def student(s_id, choices, prior=0, prior_3200=0, skills=''):
    return {
        'id': s_id, 'major': 'CS', 'class': '3200', 'choices': choices, 'gender': 'Male',
        'day': 'Wednesday', 'priorSemesters': prior, 'prior3200Semesters': prior_3200, 'skills': skills,
    }


class TieBreakTests(unittest.TestCase):
    """Two 3200s want project A, which only has room for one of them."""

    def setUp(self):
        self.projects = [{'name': name, 'type': 'SW', 'day': 'Wednesday'} for name in ('A', 'B')]
        self.config = {'min_team_size': 1, 'max_team_size': 1, 'min_upperclass_per_project': 0,
                       'balance_gender': False}

    def winner_of_a(self, students):
        result = generate_teams(students, self.projects, self.config)
        self.assertTrue(result['success'])
        return result['teams']['A'][0]

    def test_second_time_3200_beats_first_time(self):
        # The first-timer has more semesters overall, but 3200 experience comes first.
        students = [student('new', ['A', 'B'], prior=4), student('back', ['A', 'B'], prior=1, prior_3200=1)]
        self.assertEqual(self.winner_of_a(students), 'back')
        self.assertEqual(self.winner_of_a(students[::-1]), 'back')

    def test_more_semesters_breaks_the_rest(self):
        students = [student('few', ['A', 'B'], prior=1), student('many', ['A', 'B'], prior=3)]
        self.assertEqual(self.winner_of_a(students), 'many')
        self.assertEqual(self.winner_of_a(students[::-1]), 'many')

    def test_never_costs_a_better_choice(self):
        # The veteran ranks B second, so giving them A would push the newcomer to an
        # unranked spot. Real choice scores win; the tie-break only settles true ties.
        students = [student('vet', ['A', 'B'], prior=5, prior_3200=2), student('new', ['A'])]
        self.assertEqual(self.winner_of_a(students), 'new')

    def test_skill_fit_breaks_a_full_tie(self):
        # Same experience, same choices: the student whose skills match project A wins it.
        projects = [{'name': 'A', 'type': 'SW', 'day': 'Wednesday', 'skills': 'Python, Flask, SQL'},
                    {'name': 'B', 'type': 'SW', 'day': 'Wednesday', 'skills': 'Welding'}]
        students = [student('weak', ['A', 'B'], prior=1, skills='Welding, CAD'),
                    student('fit', ['A', 'B'], prior=1, skills='Python, SQL')]
        for order in (students, students[::-1]):
            result = generate_teams(order, projects, self.config)
            self.assertTrue(result['success'])
            self.assertEqual(result['teams']['A'][0], 'fit')

    def test_skill_fit_never_beats_experience(self):
        projects = [{'name': 'A', 'type': 'SW', 'day': 'Wednesday', 'skills': 'Python'},
                    {'name': 'B', 'type': 'SW', 'day': 'Wednesday', 'skills': 'Welding'}]
        students = [student('vet', ['A', 'B'], prior=3, skills='Welding'),
                    student('fit', ['A', 'B'], prior=1, skills='Python')]
        result = generate_teams(students, projects, self.config)
        self.assertEqual(result['teams']['A'][0], 'vet')

    def test_provided_skill_scores_override_local(self):
        projects = [{'name': 'A', 'type': 'SW', 'day': 'Wednesday', 'skills': 'Python'},
                    {'name': 'B', 'type': 'SW', 'day': 'Wednesday', 'skills': 'Welding'}]
        a = student('llm_high', ['A', 'B'], prior=1, skills='Welding')
        a['skillScores'] = {'A': 1.0}
        b = student('local_high', ['A', 'B'], prior=1, skills='Python')
        result = generate_teams([b, a], projects, self.config)
        self.assertEqual(result['teams']['A'][0], 'llm_high')

    def test_suggest_3200_uses_the_same_order(self):
        students = [student('new', ['A', 'B'], prior=4), student('back', ['A', 'B'], prior=1, prior_3200=1)]
        result = suggest_upperclass_placements(students, self.projects, {'max_team_size': 1})
        self.assertTrue(result['success'])
        placed = {p['studentId']: p['projectName'] for p in result['placements']}
        self.assertEqual(placed, {'back': 'A', 'new': 'B'})


if __name__ == '__main__':
    unittest.main()
