#!/usr/bin/env python3
"""
Team Generation using Google OR-Tools CP-SAT Solver
Generates optimal team assignments with constraint satisfaction
"""

import json
import sys
from typing import TypedDict, Optional
from ortools.sat.python import cp_model

from skill_match import skill_fit_table


StudentDict = TypedDict('StudentDict', {
    'id': str,
    'name': str,
    'major': str,
    'seniority': str,
    'choices': list[str],
    'class': str,
    'previousProject': Optional[str],
    'gender': str,
    'day': Optional[str],
    'priorSemesters': int,
    'prior3200Semesters': int,
    'skills': str,
    'skillScores': dict,
}, total=False)

ProjectDict = TypedDict('ProjectDict', {
    'id': str,
    'name': str,
    'type': str,
    'day': Optional[str],
    'locked_count': int,
    'locked_upperclass_count': int,
    'skills': str,
}, total=False)

ConfigDict = TypedDict('ConfigDict', {
    'min_team_size': int,
    'max_team_size': int,
    'prioritize_returning_students': bool,
    'prioritize_3200_first_choice': bool,
    'balance_gender': bool,
    'max_upperclass_per_project': int,
    'min_upperclass_per_project': int,
}, total=False)


# Every real score (choice rank, returning bonus, gender, major fit) is multiplied by this,
# leaving room below it for tie-break points. Real scores are always multiples of 2.5, so
# any real difference is at least 25,000,000 here, while one student's tie-break is at most
# (19 x 100 + 99) x 6 = 11,994 — the tie-break can't outweigh a real point unless a day has
# 2,000+ students.
SCORE_SCALE = 10_000_000


def tie_break_points(student: StudentDict, pref_index: int, skill_fit: float = 0.0) -> int:
    """
    Breaks ties between students who want the same project, in this order:
      1. a student who has been in 3200 before beats a first-timer,
      2. then more semesters in EPICS wins,
      3. then the better skill fit (0..1) between the student's skills and the project's.
    Weighted by how high the choice is, so the stronger student gets the better of two
    choices. Experience moves in steps of 100 and skill fit adds at most 99, so a skill
    fit can never outweigh a whole semester of experience.
    """
    if pref_index >= 6:
        return 0
    experience = (10 if student.get('prior3200Semesters', 0) > 0 else 0) + min(student.get('priorSemesters', 0), 9)
    fit_points = round(max(0.0, min(1.0, skill_fit)) * 99)
    return (experience * 100 + fit_points) * (6 - pref_index)


def generate_teams(students_data: list[StudentDict], projects_data: list[ProjectDict], config: Optional[ConfigDict] = None):
    """
    Generate team assignments using CP-SAT solver

    Args:
        students_data: List of student dictionaries
        projects_data: List of project dictionaries
        config: Configuration dictionary (optional)

    Returns:
        Dictionary mapping project names to lists of student IDs
    """

    # Default configuration
    if config is None:
        config = {
            'min_team_size': 4,
            'max_team_size': 6,
            'prioritize_returning_students': True,
            'prioritize_3200_first_choice': True,
            'balance_gender': True,
        }

    minimum = config.get('min_upperclass_per_project', 1)
    if isinstance(minimum, bool) or not isinstance(minimum, int) or minimum < 0:
        raise ValueError('Minimum 3200 students per team must be a non-negative integer.')
    if minimum > config['max_team_size']:
        raise ValueError('Minimum 3200 students per team cannot exceed maximum team size.')
    config = {**config, 'min_upperclass_per_project': minimum}

    model = cp_model.CpModel()

    # Create indices
    students = {s['id']: s for s in students_data}
    projects = {p['name']: p for p in projects_data}
    fit_table = skill_fit_table(students_data, projects_data)  # last-level tie-break only
    student_ids = list(students.keys())
    project_names = list(projects.keys())

    # Decision variables: x[s][p] = 1 if student s is assigned to project p
    x = {}
    for s_id in student_ids:
        x[s_id] = {}
        for p_name in project_names:
            x[s_id][p_name] = model.NewBoolVar(f'x_{s_id}_{p_name}')

    # CONSTRAINT 1: Each student assigned to exactly one project
    for s_id in student_ids:
        model.Add(sum(x[s_id][p_name] for p_name in project_names) == 1)

    # CONSTRAINT 2: Every project's team size must fall within [min_team_size, max_team_size],
    # counting students already locked into that project ahead of this solve (e.g. 3200
    # students staff placed manually) even though they're not part of the solver's
    # decision variables.
    for p_name in project_names:
        locked_count = projects[p_name].get('locked_count', 0)
        team_size = sum(x[s_id][p_name] for s_id in student_ids)
        model.Add(team_size + locked_count >= config['min_team_size'])
        model.Add(team_size + locked_count <= config['max_team_size'])

    # CONSTRAINT 2b: Cap how many 3200-level students can land on any single project,
    # counting any 3200s already locked in there. Without this, the strong 3200
    # first-choice weighting below can cluster most of the 3200s onto a handful of
    # popular projects, leaving others without one. Optional — only enforced when
    # the caller sets max_upperclass_per_project.
    max_upperclass_per_project = config.get('max_upperclass_per_project')
    if max_upperclass_per_project is not None:
        for p_name in project_names:
            locked_upperclass_count = projects[p_name].get('locked_upperclass_count', 0)
            upperclass_size = sum(
                x[s_id][p_name] for s_id in student_ids if students[s_id]['class'] == '3200'
            )
            model.Add(upperclass_size + locked_upperclass_count <= max_upperclass_per_project)

    # CONSTRAINT 2c: Guarantee at least min_upperclass_per_project 3200-level students
    # on every project (e.g. "every team needs a 3200 to lead it"), counting any 3200s
    # already locked in. Defaults to 1; 0 turns it off. With few enough 3200 students
    # relative to the number of teams, this can be infeasible; see the error message
    # below for that case.
    min_upperclass_per_project = config.get('min_upperclass_per_project')
    if min_upperclass_per_project is not None:
        for p_name in project_names:
            locked_upperclass_count = projects[p_name].get('locked_upperclass_count', 0)
            upperclass_size = sum(
                x[s_id][p_name] for s_id in student_ids if students[s_id]['class'] == '3200'
            )
            model.Add(upperclass_size + locked_upperclass_count >= min_upperclass_per_project)

    # CONSTRAINT 3: Only 3200 students can be returning students
    # (Validation - returning students must be 3200)
    for s_id in student_ids:
        student = students[s_id]
        if student.get('previousProject') is not None and student['class'] != '3200':
            raise ValueError(f"Student {s_id} has previousProject but is not 3200 level")

    # CONSTRAINT 4: Day matching - students can only be assigned to projects on their day
    # If a student has a day and a project has a day, they must match
    for s_id in student_ids:
        student = students[s_id]
        student_day = student.get('day')
        if student_day:
            for p_name in project_names:
                project = projects[p_name]
                project_day = project.get('day')
                if project_day and project_day != student_day:
                    model.Add(x[s_id][p_name] == 0)

    # OBJECTIVE: Maximize satisfaction score
    objective_terms = []

    for s_id in student_ids:
        student = students[s_id]
        is_3200 = student['class'] == '3200'
        is_returning = student.get('previousProject') is not None

        for p_name in project_names:
            # Base score from preference ranking
            if p_name in student['choices']:
                pref_index = student['choices'].index(p_name)

                # Score decreases with preference rank
                if pref_index == 0:  # First choice
                    base_score = 1000
                elif pref_index == 1:  # Second choice
                    base_score = 500
                elif pref_index == 2:  # Third choice
                    base_score = 200
                elif pref_index == 3:  # Fourth choice
                    base_score = 100
                elif pref_index == 4:  # Fifth choice
                    base_score = 50
                elif pref_index == 5:  # Sixth choice
                    base_score = 25
                else:
                    base_score = 0

                # 3200 students heavily prioritize first choice
                if is_3200 and config.get('prioritize_3200_first_choice', True):
                    base_score *= 100  # 100x multiplier for 3200 students

                # Returning student bonus: 3200 students CAN choose any project, but if they
                # include their previous project in their choices, boost that assignment's score.
                if config.get('prioritize_returning_students', True) and is_returning and student['previousProject'] == p_name:
                    base_score *= 1.5

                score = round(base_score * SCORE_SCALE) + tie_break_points(student, pref_index, fit_table.get(s_id, {}).get(p_name, 0.0))
                objective_terms.append(score * x[s_id][p_name])

    # SOFT CONSTRAINT: Gender balance (add penalty for imbalanced teams)
    if config.get('balance_gender', True):
        for p_name in project_names:
            # Count students of each gender on this team
            gender_vars = {'Male': [], 'Female': [], 'Prefer not to say': []}

            for s_id in student_ids:
                student = students[s_id]
                gender = student.get('gender', 'Prefer not to say')
                if gender in gender_vars:
                    gender_vars[gender].append(x[s_id][p_name])

            # Create variables for gender counts
            male_count = model.NewIntVar(0, config['max_team_size'], f'male_count_{p_name}')
            female_count = model.NewIntVar(0, config['max_team_size'], f'female_count_{p_name}')

            if gender_vars['Male']:
                model.Add(male_count == sum(gender_vars['Male']))
            else:
                model.Add(male_count == 0)

            if gender_vars['Female']:
                model.Add(female_count == sum(gender_vars['Female']))
            else:
                model.Add(female_count == 0)

            # Penalty variable for male isolation
            male_isolated = model.NewBoolVar(f'male_isolated_{p_name}')
            model.Add(male_count == 1).OnlyEnforceIf(male_isolated)
            model.Add(male_count != 1).OnlyEnforceIf(male_isolated.Not())

            # Penalty variable for female isolation
            female_isolated = model.NewBoolVar(f'female_isolated_{p_name}')
            model.Add(female_count == 1).OnlyEnforceIf(female_isolated)
            model.Add(female_count != 1).OnlyEnforceIf(female_isolated.Not())

            # Apply penalty (negative score) for isolation
            objective_terms.append(-500 * SCORE_SCALE * male_isolated)  # Penalty for 1 male among others
            objective_terms.append(-500 * SCORE_SCALE * female_isolated)  # Penalty for 1 female among others

    # SOFT CONSTRAINT: Major fit based on project type (software/hardware adjacency)
    software_majors = {'CS', 'SE', 'DS'}
    hardware_majors = {'EE', 'ME', 'BME', 'CE'}

    for p_name in project_names:
        project = projects[p_name]
        project_type = project.get('type', '')

        for s_id in student_ids:
            student = students[s_id]
            student_major = student['major']
            bonus = 0

            # "Both" projects accept all majors - give bonus to everyone
            if project_type == 'Both':
                bonus = 80
            # SW projects: bonus for software-adjacent majors
            elif project_type == 'SW' and student_major in software_majors:
                bonus = 60
            # HW projects: bonus for hardware-adjacent majors
            elif project_type == 'HW' and student_major in hardware_majors:
                bonus = 60

            if bonus > 0:
                objective_terms.append(bonus * SCORE_SCALE * x[s_id][p_name])

    # Maximize total satisfaction
    model.Maximize(sum(objective_terms))

    # Solve
    solver = cp_model.CpSolver()

    # Set time limit (30 seconds)
    solver.parameters.max_time_in_seconds = 30.0

    status = solver.Solve(model)

    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        # Extract solution
        teams = {p_name: [] for p_name in project_names}

        for s_id in student_ids:
            for p_name in project_names:
                if solver.Value(x[s_id][p_name]) == 1:
                    teams[p_name].append(s_id)
                    break

        return {
            'success': True,
            'teams': teams,
            'score': solver.ObjectiveValue() / SCORE_SCALE,
            'solve_time': solver.WallTime(),
            'status': 'optimal' if status == cp_model.OPTIMAL else 'feasible',
        }
    else:
        total_students = len(student_ids)
        total_teams = len(project_names)
        # Remaining capacity per project after accounting for students already locked in.
        min_capacity = sum(max(0, config['min_team_size'] - projects[p].get('locked_count', 0)) for p in project_names)
        max_capacity = sum(max(0, config['max_team_size'] - projects[p].get('locked_count', 0)) for p in project_names)

        if total_students < min_capacity:
            error = (
                f'Not enough students: {total_students} student(s) across {total_teams} team(s), '
                f'but a minimum team size of {config["min_team_size"]} requires at least {min_capacity}. '
                'Lower the minimum team size, enroll more students, or reduce the number of active teams.'
            )
        elif total_students > max_capacity:
            error = (
                f'Too many students: {total_students} student(s) across {total_teams} team(s), '
                f'but a maximum team size of {config["max_team_size"]} allows at most {max_capacity}. '
                'Raise the maximum team size, add more teams, or reduce enrollment for this semester and day.'
            )
        else:
            max_upperclass_per_project = config.get('max_upperclass_per_project')
            total_upperclass = sum(1 for s in students.values() if s['class'] == '3200')
            upperclass_capacity = (
                sum(max(0, max_upperclass_per_project - projects[p].get('locked_upperclass_count', 0)) for p in project_names)
                if max_upperclass_per_project is not None else None
            )
            min_upperclass_per_project = config.get('min_upperclass_per_project')
            upperclass_needed = (
                sum(max(0, min_upperclass_per_project - projects[p].get('locked_upperclass_count', 0)) for p in project_names)
                if min_upperclass_per_project is not None else None
            )

            if upperclass_capacity is not None and total_upperclass > upperclass_capacity:
                error = (
                    f'Too many 3200 students for the "max {max_upperclass_per_project} per project" cap: '
                    f'{total_upperclass} 3200 student(s) across {total_teams} team(s), but the cap allows at '
                    f'most {upperclass_capacity} total. Raise the max-3200-per-project cap, or add more teams.'
                )
            elif upperclass_needed is not None and total_upperclass < upperclass_needed:
                error = (
                    f'Not enough 3200 students for the "at least {min_upperclass_per_project} per project" '
                    f'requirement: {total_upperclass} 3200 student(s) across {total_teams} team(s), but '
                    f'{upperclass_needed} are needed to give every team one. Lower the minimum, reduce the '
                    'number of active teams, or lock a few teams manually and generate the rest separately.'
                )
            else:
                error = (
                    f'No assignment exists that keeps every team within the configured min/max team size, '
                    f'even though {total_students} student(s) fits the overall capacity for {total_teams} team(s) '
                    '(this can happen when other requirements, such as meeting-day splits or the 3200-per-project '
                    'min/max, prevent a valid assignment). Try adjusting min/max team size, the 3200-per-project '
                    'settings, or the set of active projects/teams for this semester and day.'
                )

        return {
            'success': False,
            'error': error,
        }


def suggest_upperclass_placements(students_data: list[StudentDict], projects_data: list[ProjectDict], config: Optional[ConfigDict] = None):
    """
    Suggest team placements for a subset of students (typically 3200-level, called
    ahead of the main solve) — guaranteeing each student their 1st or 2nd choice
    whenever at all possible, falling back to 3rd choice only if no full solution
    exists otherwise. Unlike generate_teams, this does not enforce a minimum team
    size (this is a partial, early placement pass) — it only caps each project at
    max_team_size, counting any students already locked in.

    Students with no submitted choices are set aside (returned separately) rather
    than blocking a solution for everyone else. Also caps how many of these students
    can land on any single project (`max_upperclass_per_project`, counting anyone
    already locked there) — so one popular project can't absorb most of the 3200s
    and leave other projects without a 3200 to lead them.
    """
    if config is None:
        config = {'max_team_size': 6}
    max_per_project = config.get('max_upperclass_per_project', config['max_team_size'])

    projects = {p['name']: p for p in projects_data}
    project_names = list(projects.keys())

    with_choices = [s for s in students_data if s.get('choices')]
    without_choices_ids = [s['id'] for s in students_data if not s.get('choices')]
    students = {s['id']: s for s in with_choices}
    fit_table = skill_fit_table(with_choices, projects_data)  # last-level tie-break only
    student_ids = list(students.keys())

    def try_solve(max_rank: int):
        model = cp_model.CpModel()
        x = {}
        for s_id in student_ids:
            student = students[s_id]
            allowed = [p for p in student['choices'][:max_rank] if p in projects]
            if not allowed:
                return None
            x[s_id] = {}
            for p_name in project_names:
                x[s_id][p_name] = model.NewBoolVar(f'x_{s_id}_{p_name}')
                if p_name not in allowed:
                    model.Add(x[s_id][p_name] == 0)

        for s_id in student_ids:
            model.Add(sum(x[s_id][p_name] for p_name in project_names) == 1)

        for p_name in project_names:
            locked_count = projects[p_name].get('locked_count', 0)
            team_size = sum(x[s_id][p_name] for s_id in student_ids)
            model.Add(team_size + locked_count <= config['max_team_size'])
            # Every student in this pass is a 3200, so the cap only counts locked 3200s,
            # not locked 2200s.
            locked_upperclass_count = projects[p_name].get('locked_upperclass_count', 0)
            model.Add(team_size + locked_upperclass_count <= max_per_project)

        objective_terms = []
        for s_id in student_ids:
            student = students[s_id]
            is_returning = student.get('previousProject') is not None
            for p_name in project_names:
                if p_name in student['choices']:
                    pref_index = student['choices'].index(p_name)
                    base_score = max(0, 1000 - pref_index * 300)
                    if is_returning and student['previousProject'] == p_name:
                        base_score *= 1.5
                    score = round(base_score * SCORE_SCALE) + tie_break_points(student, pref_index, fit_table.get(s_id, {}).get(p_name, 0.0))
                    objective_terms.append(score * x[s_id][p_name])
        model.Maximize(sum(objective_terms))

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 15.0
        status = solver.Solve(model)
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return solver, x
        return None

    if not student_ids:
        return {'success': True, 'placements': [], 'usedFallbackThirdChoice': False, 'noChoicesStudentIds': without_choices_ids}

    used_fallback = False
    result = try_solve(2)
    if result is None:
        result = try_solve(3)
        used_fallback = True

    if result is None:
        return {
            'success': False,
            'error': 'Could not place every 3200 student within their top 3 choices given current team capacity. Try locking some manually first, or increase max team size.',
        }

    solver, x = result
    placements = []
    for s_id in student_ids:
        student = students[s_id]
        for p_name in project_names:
            if solver.Value(x[s_id][p_name]) == 1:
                rank = student['choices'].index(p_name) + 1  # 1-indexed for readability
                placements.append({
                    'studentId': s_id,
                    'projectName': p_name,
                    'choiceRank': rank,
                    'isReturning': student.get('previousProject') == p_name,
                })
                break

    return {
        'success': True,
        'placements': placements,
        'usedFallbackThirdChoice': used_fallback,
        'noChoicesStudentIds': without_choices_ids,
    }


def main():
    """Main entry point when called from command line"""
    try:
        # Read JSON input from stdin
        input_data = json.loads(sys.stdin.read())

        students = input_data['students']
        projects = input_data['projects']
        config = input_data.get('config', None)
        mode = input_data.get('mode', 'generate')

        if mode == 'suggest_3200':
            result = suggest_upperclass_placements(students, projects, config)
        else:
            result = generate_teams(students, projects, config)

        # Output result as JSON
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
