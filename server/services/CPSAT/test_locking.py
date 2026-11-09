import unittest
from team_generator import generate_teams, suggest_upperclass_placements


class LockingTests(unittest.TestCase):
    def setUp(self):
        self.projects = [{'name': n, 'type': 'SW', 'day': 'Wednesday',
                          'locked_count': 0, 'locked_upperclass_count': 0} for n in ('A', 'B')]
        self.students = [{'id': str(i), 'major': 'CS', 'class': '3200' if i < 2 else '2200',
                          'choices': ['A', 'B'], 'gender': 'Male', 'day': 'Wednesday'} for i in range(8)]
        self.config = {'min_team_size': 4, 'max_team_size': 6,
                       'min_upperclass_per_project': 1, 'balance_gender': False}

    def solve(self):
        return generate_teams(self.students, self.projects, self.config)

    def reserve(self, ids, project_index=0):
        locked = [s for s in self.students if s['id'] in ids]
        self.students = [s for s in self.students if s['id'] not in ids]
        project = self.projects[project_index]
        project['locked_count'] += len(locked)
        project['locked_upperclass_count'] += sum(s['class'] == '3200' for s in locked)
        return locked

    def assert_valid(self, result):
        self.assertTrue(result['success'], result)
        self.assertCountEqual([s for roster in result['teams'].values() for s in roster],
                              [s['id'] for s in self.students])
        for p in self.projects:
            roster = result['teams'][p['name']]
            self.assertGreaterEqual(len(roster) + p['locked_count'], self.config['min_team_size'])
            self.assertLessEqual(len(roster) + p['locked_count'], 6)
            upper = sum(s['class'] == '3200' for s in self.students if s['id'] in roster)
            self.assertGreaterEqual(upper + p['locked_upperclass_count'], 1)

    def test_individual_lock_reserves_capacity_and_3200_coverage(self):
        self.reserve(['0'])
        self.assert_valid(self.solve())

    def test_bulk_locked_members_are_excluded_from_new_assignments(self):
        self.reserve(['0', '2', '3', '4'])
        result = self.solve()
        self.assert_valid(result)
        self.assertFalse(set(['0', '2', '3', '4']) & set(sum(result['teams'].values(), [])))

    def test_full_locked_team_receives_no_new_students(self):
        self.reserve(['0', '2', '3', '4', '5', '6'])
        self.config['min_team_size'] = 2
        result = self.solve()
        self.assert_valid(result)
        self.assertEqual(result['teams']['A'], [])

    def test_locked_3200_counts_toward_maximum(self):
        self.reserve(['0'])
        self.config['max_upperclass_per_project'] = 1
        result = self.solve()
        self.assert_valid(result)
        self.assertIn('1', result['teams']['B'])

    def test_locked_2200_does_not_satisfy_3200_minimum(self):
        self.reserve(['2', '3', '4', '5'])
        self.config['min_team_size'] = 3
        result = self.solve()
        self.assert_valid(result)
        self.assertTrue(set(result['teams']['A']) & {'0', '1'})

    def test_excess_locked_roster_is_infeasible(self):
        self.projects[0]['locked_count'] = 7
        self.assertFalse(self.solve()['success'])

    def test_full_locked_team_without_3200_is_infeasible(self):
        self.reserve(['2', '3', '4', '5', '6', '7'])
        self.config['min_team_size'] = 1
        self.assertFalse(self.solve()['success'])

    def test_rerun_with_changed_preferences_retains_reserved_capacity(self):
        self.reserve(['0', '2', '3', '4'])
        self.assert_valid(self.solve())
        for s in self.students:
            s['choices'] = ['B', 'A']
        self.assert_valid(self.solve())
        self.assertEqual(self.projects[0]['locked_count'], 4)
        self.assertEqual(self.projects[0]['locked_upperclass_count'], 1)

    def test_all_students_locked_can_solve_without_new_assignments(self):
        self.reserve(['0', '2', '3', '4'])
        self.reserve(['1', '5', '6', '7'], 1)
        self.assert_valid(self.solve())


    def test_suggest_cap_ignores_locked_2200s(self):
        # 4 locked 2200s on A must not use up A's 3200 cap of 1.
        projects = [{'name': 'A', 'locked_count': 4, 'locked_upperclass_count': 0},
                    {'name': 'B', 'locked_count': 0, 'locked_upperclass_count': 0}]
        students = [{'id': '0', 'choices': ['A']}]
        result = suggest_upperclass_placements(
            students, projects, {'max_team_size': 6, 'max_upperclass_per_project': 1})
        self.assertTrue(result['success'], result)
        self.assertEqual(result['placements'][0]['projectName'], 'A')

if __name__ == '__main__':
    unittest.main()
