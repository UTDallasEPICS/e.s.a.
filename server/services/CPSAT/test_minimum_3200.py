import unittest

from team_generator import generate_teams


class Minimum3200Tests(unittest.TestCase):
    def setUp(self):
        self.projects = [{'name': name, 'type': 'SW', 'day': 'Wednesday'} for name in ('A', 'B')]
        self.students = [
            {
                'id': str(i), 'major': 'CS', 'class': '3200' if i < 2 else '2200',
                'choices': ['A', 'B'], 'gender': 'Male', 'day': 'Wednesday',
            }
            for i in range(8)
        ]
        self.config = {'min_team_size': 4, 'max_team_size': 6,
                       'prioritize_3200_first_choice': False, 'balance_gender': False}

    def test_default_minimum_without_preference_priority(self):
        result = generate_teams(self.students, self.projects, self.config)
        self.assertTrue(result['success'])
        self.assertCountEqual([s for team in result['teams'].values() for s in team],
                              [s['id'] for s in self.students])
        for team in result['teams'].values():
            self.assertGreaterEqual(sum(s in ('0', '1') for s in team), 1)

    def test_custom_minimum(self):
        for student in self.students[:4]:
            student['class'] = '3200'
        result = generate_teams(self.students, self.projects, {**self.config, 'min_upperclass_per_project': 2})
        self.assertTrue(result['success'])
        for team in result['teams'].values():
            self.assertGreaterEqual(sum(s in ('0', '1', '2', '3') for s in team), 2)

    def test_insufficient_3200_students(self):
        result = generate_teams(self.students, self.projects, {**self.config, 'min_upperclass_per_project': 2})
        self.assertFalse(result['success'])
        self.assertIn('4 are needed', result['error'])

    def test_zero_disables_minimum(self):
        for student in self.students:
            student['class'] = '2200'
        result = generate_teams(self.students, self.projects, {**self.config, 'min_upperclass_per_project': 0})
        self.assertTrue(result['success'])

    def test_meeting_day_shortage(self):
        self.projects[1]['day'] = 'Thursday'
        for student in self.students[4:]:
            student['day'] = 'Thursday'
        result = generate_teams(self.students, self.projects, self.config)
        self.assertFalse(result['success'])
        self.assertIn('meeting-day', result['error'])

    def test_invalid_minimum(self):
        for minimum in (-1, 1.5, True, '1', None, 7):
            with self.subTest(minimum=minimum), self.assertRaises(ValueError):
                generate_teams(self.students, self.projects, {**self.config, 'min_upperclass_per_project': minimum})


if __name__ == '__main__':
    unittest.main()
