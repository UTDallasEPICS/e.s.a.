# Requirements

This is the single source of truth for what your hardware project must do. Capture every
requirement as a row in the matrix below, give it a stable ID, and track its status through
the project lifecycle.

> The rows below are **examples** — replace them with your own project's requirements and
> delete the ones that don't apply.

## 1. Requirement Matrix

- **Category:** Functional (`REQ-F`) — what the system does; Non-Functional (`REQ-NF`) —
  how well it does it (performance, mechanical, electrical, safety, cost, regulatory).
- **Status:** Backlog, In-progress, Verified, Deferred, Deprecated.
- **Verification:** how you will prove the requirement is met — Test, Demonstration,
  Inspection, or Analysis.
- **Mapping:** the GitHub issue, design doc, drawing, BOM line, or test that satisfies it.

| ID        | Description                                                                             | Category | Status      | Verification  | Target Semester | Mapping (issue / doc)          |
| --------- | --------------------------------------------------------------------------------------- | -------- | ----------- | ------------- | --------------- | ------------------------------ |
| REQ-F-01  | Teambuilder algorithm converts inputted skills into numerical weights     | REQ-F    | Backlog     | Test          | 2026F           | #1                             |
| REQ-F-02 | Algorithm enforces a configurable minimum of EPCS 3200 students per team (default 1; 0 disables) | REQ-F | In-progress | Test | 2026F | #9 |
| REQ-F-03 | An operator is able to lock students and teams and run algorithm on remaining "unlocked students" | REQ-F   | Backlog     | Test          | 2026F           | #3                             |
| REQ-NF-01  | Allow teambuilder to be iterative process rather than one-shot     | REQ-F    | Backlog     | Demonstration | 2026F           | #4                            |
| REQ-NF-02 | Teambuilder UI/UX/workflow is intuitive and easy for project director to navigate    | REQ-NF   | Backlog     | Test          | 2026F           | #5                             |
| REQ-NF-03 | Total bill of materials cost stays under the project budget of $500.                    | REQ-NF   | Backlog     | Analysis      | 2026F           | `docs/bom.md`                  |
| REQ-NF-04 | Total bill of materials cost stays under the project budget of $500.                    | REQ-NF   | Backlog     | Analysis      | 2026F           | `docs/bom.md`                  |
| REQ-F-04  | Users are able to edit student and project information directly on the page and save changes to the database | REQ-F  | Backlog | Test          | 2026F | #6  |
| REQ-F-05  | Dashboard displays project progress, student enrollment across semesters, historical comparisons, and pinned section with desired information | REQ-F  | Backlog | Demonstration | 2026F | #7  |
| REQ-F-06  | AI Assistant answers questions about program data using charts and visuals when applicable | REQ-F  | Backlog | Demonstration | 2026F | #8  |
| REQ-F-07  | Master student list displays major, class standing, meeting day, semesters enrolled, and role with search and filters | REQ-F  | Backlog | Test          | 2026F | #9  |
| REQ-F-08  | Project pages display editable project history, student roster, partner contacts, required skills, and filters for semester, status, and partner | REQ-F  | Backlog | Test          | 2026F | #10 |
| REQ-F-09  | Insights page displays student demographics such as year, gender, major, race, and ethnicity with timeline filters and exact numbers shown on charts | REQ-F  | Backlog | Test          | 2026F | #11 |
| REQ-NF-05 | Application is simple and easy for users to navigate between pages | REQ-NF | Backlog | Demonstration | 2026F | #12 |
| REQ-NF-06 | Database information is displayed using clean layouts, tables, and charts that are easy to understand | REQ-NF | Backlog | Inspection    | 2026F | #13 |
| REQ-NF-07 | Screens and filters update smoothly without requiring the user to wait or refresh the page | REQ-NF | Backlog | Test          | 2026F | #14 |
| REQ-NF-08 | Dashboard, student tables, and Insights graphs open within about 3 seconds | REQ-NF | Backlog | Test          | 2026F | #15 |
| REQ-NF-09 | Buttons, text formatting, and color themes stay consistent across every page | REQ-NF | Backlog | Inspection    | 2026F | #16 |

## 2. Change Log

Track major changes, additions, or deprecations to the project scope.

| Date       | Requirement ID | Change Description                                        | Author | Approved By |
| ---------- | -------------- | -------------------------------------------------------- | ------ | ----------- |
| YYYY-MM-DD | REQ-F/NF-\*    | Established the initial requirements register.           | @you   | —           |
