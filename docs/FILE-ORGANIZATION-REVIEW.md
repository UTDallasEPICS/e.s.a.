# ESA File Organization Review

This inventory lists **286 files** in the active ESA-design folder, grouped by where they are today. The categories are suggestions.

To review together, use the number or path and pick an action: **Keep**, **Move to …**, **Rename to …**, **Add comments about …**, or **Review for removal**. You can mark just the files you want to discuss.

For existing beginner notes, see the [file walkthrough](code-walkthrough/README.md). For a first pass, try the Dashboard, Students, Projects, Insights, and AI reporting files.

The inventory lists private file names without reading their contents. Framework-managed folders are listed together at the end.

## `ESA-design root`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 1 | [`.dockerignore`](../.dockerignore) | Project configuration and tooling | |
| 2 | `.env` | Local settings and data | |
| 3 | [`.env.example`](../.env.example) | Local settings and data | |
| 4 | [`.gitignore`](../.gitignore) | Project configuration and tooling | |
| 5 | [`.prettierignore`](../.prettierignore) | Project configuration and tooling | |
| 6 | [`.prettierrc`](../.prettierrc) | Project configuration and tooling | |
| 7 | [`CLAUDE.md`](../CLAUDE.md) | Documentation | |
| 8 | `dev.db` | Local settings and data | |
| 9 | [`Dockerfile`](../Dockerfile) | Project configuration and tooling | |
| 10 | [`nuxt.config.ts`](../nuxt.config.ts) | Project configuration and tooling | |
| 11 | [`package.json`](../package.json) | Project configuration and tooling | |
| 12 | [`pnpm-lock.yaml`](../pnpm-lock.yaml) | Project configuration and tooling | |
| 13 | [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) | Project configuration and tooling | |
| 14 | [`prisma.config.ts`](../prisma.config.ts) | Project configuration and tooling | |
| 15 | [`README.md`](../README.md) | Documentation | |
| 16 | [`requirements.md`](../requirements.md) | Documentation | |
| 17 | [`tsconfig.json`](../tsconfig.json) | Project configuration and tooling | |

## `.claude`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 18 | [`.claude/settings.json`](../.claude/settings.json) | Project configuration and tooling | |

## `.github/ISSUE_TEMPLATE`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 19 | [`.github/ISSUE_TEMPLATE/bug_report.md`](../.github/ISSUE_TEMPLATE/bug_report.md) | Documentation | |
| 20 | [`.github/ISSUE_TEMPLATE/feature_request.md`](../.github/ISSUE_TEMPLATE/feature_request.md) | Documentation | |

## `.github/workflows`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 21 | [`.github/workflows/prod.yml`](../.github/workflows/prod.yml) | Project configuration and tooling | |
| 22 | [`.github/workflows/stage.yml`](../.github/workflows/stage.yml) | Project configuration and tooling | |

## `app`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 23 | [`app/app.vue`](../app/app.vue) | Frontend data and helpers | |

## `app/assets/css`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 24 | [`app/assets/css/main.css`](../app/assets/css/main.css) | Styles and assets | |

## `app/components`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 25 | [`app/components/contentStore.ts`](../app/components/contentStore.ts) | Frontend data and helpers | |
| 26 | [`app/components/data.ts`](../app/components/data.ts) | Frontend data and helpers | |
| 27 | [`app/components/DataTable.vue`](../app/components/DataTable.vue) | Frontend data and helpers | |
| 28 | [`app/components/fall2026.json`](../app/components/fall2026.json) | Frontend data and helpers | |
| 29 | [`app/components/Navbar.vue`](../app/components/Navbar.vue) | Frontend data and helpers | |
| 30 | [`app/components/PartnerContactList.vue`](../app/components/PartnerContactList.vue) | Frontend data and helpers | |
| 31 | [`app/components/PartnersTab.vue`](../app/components/PartnersTab.vue) | Frontend data and helpers | |
| 32 | [`app/components/ProjectRowExpansion.vue`](../app/components/ProjectRowExpansion.vue) | Frontend data and helpers | |
| 33 | [`app/components/projectSemesterStatus.ts`](../app/components/projectSemesterStatus.ts) | Frontend data and helpers | |
| 34 | [`app/components/ProjectsTab.vue`](../app/components/ProjectsTab.vue) | Frontend data and helpers | |
| 35 | [`app/components/ProjectTeamCard.vue`](../app/components/ProjectTeamCard.vue) | Frontend data and helpers | |
| 36 | [`app/components/RecordSearchInput.vue`](../app/components/RecordSearchInput.vue) | Frontend data and helpers | |
| 37 | [`app/components/SemesterFilter.vue`](../app/components/SemesterFilter.vue) | Frontend data and helpers | |
| 38 | [`app/components/StudentSemesterCard.vue`](../app/components/StudentSemesterCard.vue) | Frontend data and helpers | |
| 39 | [`app/components/StudentsTab.vue`](../app/components/StudentsTab.vue) | Frontend data and helpers | |
| 40 | [`app/components/types.ts`](../app/components/types.ts) | Frontend data and helpers | |
| 41 | [`app/components/verified-data.json`](../app/components/verified-data.json) | Frontend data and helpers | |

## `app/components/database-redesign`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 42 | [`app/components/database-redesign/aiResultPresentation.test.ts`](../app/components/database-redesign/aiResultPresentation.test.ts) | Tests | |
| 43 | [`app/components/database-redesign/aiResultPresentation.ts`](../app/components/database-redesign/aiResultPresentation.ts) | Redesign interface | |
| 44 | [`app/components/database-redesign/Dashboard.vue`](../app/components/database-redesign/Dashboard.vue) | Redesign interface | |
| 45 | [`app/components/database-redesign/figma-redesign.css`](../app/components/database-redesign/figma-redesign.css) | Redesign interface | |
| 46 | [`app/components/database-redesign/InsightsPage.vue`](../app/components/database-redesign/InsightsPage.vue) | Redesign interface | |
| 47 | [`app/components/database-redesign/IntakePage.vue`](../app/components/database-redesign/IntakePage.vue) | Redesign interface | |
| 48 | [`app/components/database-redesign/PartnersPage.vue`](../app/components/database-redesign/PartnersPage.vue) | Redesign interface | |
| 49 | [`app/components/database-redesign/printAIResult.ts`](../app/components/database-redesign/printAIResult.ts) | Redesign interface | |
| 50 | [`app/components/database-redesign/ProjectsPage.vue`](../app/components/database-redesign/ProjectsPage.vue) | Redesign interface | |
| 51 | [`app/components/database-redesign/SankeyChart.vue`](../app/components/database-redesign/SankeyChart.vue) | Redesign interface | |
| 52 | [`app/components/database-redesign/SettingsPage.vue`](../app/components/database-redesign/SettingsPage.vue) | Redesign interface | |
| 53 | [`app/components/database-redesign/StatusBadge.vue`](../app/components/database-redesign/StatusBadge.vue) | Redesign interface | |
| 54 | [`app/components/database-redesign/StudentsPage.vue`](../app/components/database-redesign/StudentsPage.vue) | Redesign interface | |

## `app/components/modals`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 55 | [`app/components/modals/ConfirmationModal.vue`](../app/components/modals/ConfirmationModal.vue) | Frontend data and helpers | |
| 56 | [`app/components/modals/ContactFormModal.vue`](../app/components/modals/ContactFormModal.vue) | Frontend data and helpers | |
| 57 | [`app/components/modals/CreateSemesterModal.vue`](../app/components/modals/CreateSemesterModal.vue) | Frontend data and helpers | |
| 58 | [`app/components/modals/MemberPickerModal.vue`](../app/components/modals/MemberPickerModal.vue) | Frontend data and helpers | |
| 59 | [`app/components/modals/ModalFooter.vue`](../app/components/modals/ModalFooter.vue) | Frontend data and helpers | |
| 60 | [`app/components/modals/MoveMemberModal.vue`](../app/components/modals/MoveMemberModal.vue) | Frontend data and helpers | |
| 61 | [`app/components/modals/ProjectPickerModal.vue`](../app/components/modals/ProjectPickerModal.vue) | Frontend data and helpers | |
| 62 | [`app/components/modals/SemesterInfoModal.vue`](../app/components/modals/SemesterInfoModal.vue) | Frontend data and helpers | |
| 63 | [`app/components/modals/TeamFormModal.vue`](../app/components/modals/TeamFormModal.vue) | Frontend data and helpers | |

## `app/composables`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 64 | [`app/composables/useConfirm.ts`](../app/composables/useConfirm.ts) | Frontend data and helpers | |
| 65 | [`app/composables/useDirectory.ts`](../app/composables/useDirectory.ts) | Frontend data and helpers | |
| 66 | [`app/composables/useRecordModals.ts`](../app/composables/useRecordModals.ts) | Frontend data and helpers | |
| 67 | [`app/composables/useRowStaging.ts`](../app/composables/useRowStaging.ts) | Frontend data and helpers | |
| 68 | [`app/composables/useSemesterCards.ts`](../app/composables/useSemesterCards.ts) | Frontend data and helpers | |
| 69 | [`app/composables/useSemesterFilter.ts`](../app/composables/useSemesterFilter.ts) | Frontend data and helpers | |
| 70 | [`app/composables/useSemesters.ts`](../app/composables/useSemesters.ts) | Frontend data and helpers | |
| 71 | [`app/composables/useStagedChanges.ts`](../app/composables/useStagedChanges.ts) | Frontend data and helpers | |
| 72 | [`app/composables/useStagedSave.ts`](../app/composables/useStagedSave.ts) | Frontend data and helpers | |

## `app/middleware`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 73 | [`app/middleware/auth.global.ts`](../app/middleware/auth.global.ts) | Frontend data and helpers | |

## `app/pages`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 74 | [`app/pages/auth.vue`](../app/pages/auth.vue) | Pages and URLs | |
| 75 | [`app/pages/automation.vue`](../app/pages/automation.vue) | Pages and URLs | |
| 76 | [`app/pages/database-redesign.vue`](../app/pages/database-redesign.vue) | Pages and URLs | |
| 77 | [`app/pages/database.vue`](../app/pages/database.vue) | Pages and URLs | |
| 78 | [`app/pages/inactive.vue`](../app/pages/inactive.vue) | Pages and URLs | |
| 79 | [`app/pages/index.vue`](../app/pages/index.vue) | Pages and URLs | |
| 80 | [`app/pages/team-formation.vue`](../app/pages/team-formation.vue) | Pages and URLs | |
| 81 | [`app/pages/users.vue`](../app/pages/users.vue) | Pages and URLs | |

## `app/utils`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 82 | [`app/utils/auth-client.ts`](../app/utils/auth-client.ts) | Frontend data and helpers | |
| 83 | [`app/utils/bidCsv.ts`](../app/utils/bidCsv.ts) | Frontend data and helpers | |
| 84 | [`app/utils/columns.ts`](../app/utils/columns.ts) | Frontend data and helpers | |
| 85 | [`app/utils/csvExport.ts`](../app/utils/csvExport.ts) | Frontend data and helpers | |
| 86 | [`app/utils/errors.ts`](../app/utils/errors.ts) | Frontend data and helpers | |
| 87 | [`app/utils/icons.ts`](../app/utils/icons.ts) | Frontend data and helpers | |
| 88 | [`app/utils/labels.ts`](../app/utils/labels.ts) | Frontend data and helpers | |
| 89 | [`app/utils/options.ts`](../app/utils/options.ts) | Frontend data and helpers | |
| 90 | [`app/utils/recordDrafts.ts`](../app/utils/recordDrafts.ts) | Frontend data and helpers | |
| 91 | [`app/utils/search.ts`](../app/utils/search.ts) | Frontend data and helpers | |

## `docs`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 92 | [`docs/better_auth.md`](../docs/better_auth.md) | Documentation | |
| 93 | [`docs/FILE-ORGANIZATION-REVIEW.md`](../docs/FILE-ORGANIZATION-REVIEW.md) | Documentation | |
| 94 | [`docs/file_upload_and_serve.md`](../docs/file_upload_and_serve.md) | Documentation | |

## `docs/adr`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 95 | [`docs/adr/001_template.md`](../docs/adr/001_template.md) | Documentation | |

## `docs/code-walkthrough`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 96 | [`docs/code-walkthrough/app.md`](../docs/code-walkthrough/app.md) | Documentation | |
| 97 | [`docs/code-walkthrough/claude.md`](../docs/code-walkthrough/claude.md) | Documentation | |
| 98 | [`docs/code-walkthrough/docs.md`](../docs/code-walkthrough/docs.md) | Documentation | |
| 99 | [`docs/code-walkthrough/github.md`](../docs/code-walkthrough/github.md) | Documentation | |
| 100 | [`docs/code-walkthrough/prisma.md`](../docs/code-walkthrough/prisma.md) | Documentation | |
| 101 | [`docs/code-walkthrough/public.md`](../docs/code-walkthrough/public.md) | Documentation | |
| 102 | [`docs/code-walkthrough/README.md`](../docs/code-walkthrough/README.md) | Documentation | |
| 103 | [`docs/code-walkthrough/root.md`](../docs/code-walkthrough/root.md) | Documentation | |
| 104 | [`docs/code-walkthrough/scripts.md`](../docs/code-walkthrough/scripts.md) | Documentation | |
| 105 | [`docs/code-walkthrough/server.md`](../docs/code-walkthrough/server.md) | Documentation | |
| 106 | [`docs/code-walkthrough/wpr.md`](../docs/code-walkthrough/wpr.md) | Documentation | |

## `docs/design`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 107 | [`docs/design/data_table.md`](../docs/design/data_table.md) | Documentation | |
| 108 | [`docs/design/staging.md`](../docs/design/staging.md) | Documentation | |
| 109 | [`docs/design/team_generation.md`](../docs/design/team_generation.md) | Documentation | |
| 110 | [`docs/design/ui.md`](../docs/design/ui.md) | Documentation | |

## `docs/problems`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 111 | [`docs/problems/complexity.md`](../docs/problems/complexity.md) | Documentation | |
| 112 | [`docs/problems/performance.md`](../docs/problems/performance.md) | Documentation | |

## `prisma`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 113 | [`prisma/schema.prisma`](../prisma/schema.prisma) | Database schema and import sources | |
| 114 | [`prisma/seed.ts`](../prisma/seed.ts) | Database schema and import sources | |

## `prisma/generated`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 115 | [`prisma/generated/browser.ts`](../prisma/generated/browser.ts) | Generated database client | |
| 116 | [`prisma/generated/client.ts`](../prisma/generated/client.ts) | Generated database client | |
| 117 | [`prisma/generated/commonInputTypes.ts`](../prisma/generated/commonInputTypes.ts) | Generated database client | |
| 118 | [`prisma/generated/enums.ts`](../prisma/generated/enums.ts) | Generated database client | |
| 119 | [`prisma/generated/models.ts`](../prisma/generated/models.ts) | Generated database client | |

## `prisma/generated/internal`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 120 | [`prisma/generated/internal/class.ts`](../prisma/generated/internal/class.ts) | Generated database client | |
| 121 | [`prisma/generated/internal/prismaNamespace.ts`](../prisma/generated/internal/prismaNamespace.ts) | Generated database client | |
| 122 | [`prisma/generated/internal/prismaNamespaceBrowser.ts`](../prisma/generated/internal/prismaNamespaceBrowser.ts) | Generated database client | |

## `prisma/generated/models`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 123 | [`prisma/generated/models/Account.ts`](../prisma/generated/models/Account.ts) | Generated database client | |
| 124 | [`prisma/generated/models/Choice.ts`](../prisma/generated/models/Choice.ts) | Generated database client | |
| 125 | [`prisma/generated/models/Contact.ts`](../prisma/generated/models/Contact.ts) | Generated database client | |
| 126 | [`prisma/generated/models/Enrollment.ts`](../prisma/generated/models/Enrollment.ts) | Generated database client | |
| 127 | [`prisma/generated/models/Membership.ts`](../prisma/generated/models/Membership.ts) | Generated database client | |
| 128 | [`prisma/generated/models/Partner.ts`](../prisma/generated/models/Partner.ts) | Generated database client | |
| 129 | [`prisma/generated/models/Project.ts`](../prisma/generated/models/Project.ts) | Generated database client | |
| 130 | [`prisma/generated/models/Semester.ts`](../prisma/generated/models/Semester.ts) | Generated database client | |
| 131 | [`prisma/generated/models/Session.ts`](../prisma/generated/models/Session.ts) | Generated database client | |
| 132 | [`prisma/generated/models/Student.ts`](../prisma/generated/models/Student.ts) | Generated database client | |
| 133 | [`prisma/generated/models/Team.ts`](../prisma/generated/models/Team.ts) | Generated database client | |
| 134 | [`prisma/generated/models/User.ts`](../prisma/generated/models/User.ts) | Generated database client | |
| 135 | [`prisma/generated/models/Verification.ts`](../prisma/generated/models/Verification.ts) | Generated database client | |

## `prisma/migrations`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 136 | [`prisma/migrations/migration_lock.toml`](../prisma/migrations/migration_lock.toml) | Database migrations | |

## `prisma/migrations/20260323211219_init`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 137 | [`prisma/migrations/20260323211219_init/migration.sql`](../prisma/migrations/20260323211219_init/migration.sql) | Database migrations | |

## `prisma/migrations/20260712153321_teambuilder_schema`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 138 | [`prisma/migrations/20260712153321_teambuilder_schema/migration.sql`](../prisma/migrations/20260712153321_teambuilder_schema/migration.sql) | Database migrations | |

## `prisma/migrations/20260820174937_add_enrollment_skills_comments`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 139 | [`prisma/migrations/20260820174937_add_enrollment_skills_comments/migration.sql`](../prisma/migrations/20260820174937_add_enrollment_skills_comments/migration.sql) | Database migrations | |

## `prisma/migrations/20260826050632_add_user_role`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 140 | [`prisma/migrations/20260826050632_add_user_role/migration.sql`](../prisma/migrations/20260826050632_add_user_role/migration.sql) | Database migrations | |

## `prisma/migrations/20260826165638_add_user_active`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 141 | [`prisma/migrations/20260826165638_add_user_active/migration.sql`](../prisma/migrations/20260826165638_add_user_active/migration.sql) | Database migrations | |

## `prisma/migrations/20261123020000_nullable_student_netid`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 142 | [`prisma/migrations/20261123020000_nullable_student_netid/migration.sql`](../prisma/migrations/20261123020000_nullable_student_netid/migration.sql) | Database migrations | |

## `prisma/migrations/20261123030000_verification_identifier_unique`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 143 | [`prisma/migrations/20261123030000_verification_identifier_unique/migration.sql`](../prisma/migrations/20261123030000_verification_identifier_unique/migration.sql) | Database migrations | |

## `prisma/seeddata`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 144 | [`prisma/seeddata/EPICS Projects Team Builder Andrea Spreadsheet.xlsx`](../prisma/seeddata/EPICS%20Projects%20Team%20Builder%20Andrea%20Spreadsheet.xlsx) | Database schema and import sources | |
| 145 | [`prisma/seeddata/partners.json`](../prisma/seeddata/partners.json) | Database schema and import sources | |
| 146 | [`prisma/seeddata/projects.json`](../prisma/seeddata/projects.json) | Database schema and import sources | |
| 147 | [`prisma/seeddata/SP26 Project_Bid_Response_Report_Th_Lab_Bid (2).csv`](../prisma/seeddata/SP26%20Project_Bid_Response_Report_Th_Lab_Bid%20%282%29.csv) | Database schema and import sources | |
| 148 | [`prisma/seeddata/SP26 Project_Bid_Response_Report_Wed_Lab (1).csv`](../prisma/seeddata/SP26%20Project_Bid_Response_Report_Wed_Lab%20%281%29.csv) | Database schema and import sources | |
| 149 | [`prisma/seeddata/students.json`](../prisma/seeddata/students.json) | Database schema and import sources | |

## `public`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 150 | [`public/ai-capabilities.html`](../public/ai-capabilities.html) | Public static files | |
| 151 | [`public/favicon.ico`](../public/favicon.ico) | Public static files | |
| 152 | [`public/robots.txt`](../public/robots.txt) | Public static files | |

## `scripts`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 153 | [`scripts/ai-capability-suite.ts`](../scripts/ai-capability-suite.ts) | Maintenance scripts | |
| 154 | [`scripts/check-redesign-vue-views.ts`](../scripts/check-redesign-vue-views.ts) | Maintenance scripts | |
| 155 | [`scripts/create-local-password-setup.ts`](../scripts/create-local-password-setup.ts) | Maintenance scripts | |
| 156 | [`scripts/deep-live-ai-audit.ts`](../scripts/deep-live-ai-audit.ts) | Maintenance scripts | |
| 157 | [`scripts/importFall2026.ts`](../scripts/importFall2026.ts) | Maintenance scripts | |
| 158 | [`scripts/importVerifiedData.ts`](../scripts/importVerifiedData.ts) | Maintenance scripts | |

## `server/api/ai`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 159 | [`server/api/ai/ask.post.ts`](../server/api/ai/ask.post.ts) | API endpoints | |

## `server/api/auth`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 160 | [`server/api/auth/[...all].ts`](../server/api/auth/%5B...all%5D.ts) | API endpoints | |

## `server/api/choices`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 161 | [`server/api/choices/[id].delete.ts`](../server/api/choices/%5Bid%5D.delete.ts) | API endpoints | |
| 162 | [`server/api/choices/[id].get.ts`](../server/api/choices/%5Bid%5D.get.ts) | API endpoints | |
| 163 | [`server/api/choices/[id].put.ts`](../server/api/choices/%5Bid%5D.put.ts) | API endpoints | |
| 164 | [`server/api/choices/index.post.ts`](../server/api/choices/index.post.ts) | API endpoints | |

## `server/api/contacts`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 165 | [`server/api/contacts/[id].delete.ts`](../server/api/contacts/%5Bid%5D.delete.ts) | API endpoints | |
| 166 | [`server/api/contacts/[id].get.ts`](../server/api/contacts/%5Bid%5D.get.ts) | API endpoints | |
| 167 | [`server/api/contacts/[id].put.ts`](../server/api/contacts/%5Bid%5D.put.ts) | API endpoints | |
| 168 | [`server/api/contacts/index.post.ts`](../server/api/contacts/index.post.ts) | API endpoints | |

## `server/api/discord`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 169 | [`server/api/discord/assign-project-roles.post.ts`](../server/api/discord/assign-project-roles.post.ts) | API endpoints | |
| 170 | [`server/api/discord/delete-channels.post.ts`](../server/api/discord/delete-channels.post.ts) | API endpoints | |
| 171 | [`server/api/discord/delete-roles.post.ts`](../server/api/discord/delete-roles.post.ts) | API endpoints | |
| 172 | [`server/api/discord/diagnostics.get.ts`](../server/api/discord/diagnostics.get.ts) | API endpoints | |
| 173 | [`server/api/discord/project-roles.get.ts`](../server/api/discord/project-roles.get.ts) | API endpoints | |
| 174 | [`server/api/discord/restart.post.ts`](../server/api/discord/restart.post.ts) | API endpoints | |
| 175 | [`server/api/discord/start.post.ts`](../server/api/discord/start.post.ts) | API endpoints | |
| 176 | [`server/api/discord/status.get.ts`](../server/api/discord/status.get.ts) | API endpoints | |
| 177 | [`server/api/discord/stop.post.ts`](../server/api/discord/stop.post.ts) | API endpoints | |
| 178 | [`server/api/discord/update-channels.post.ts`](../server/api/discord/update-channels.post.ts) | API endpoints | |

## `server/api/enrollments`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 179 | [`server/api/enrollments/[id].delete.ts`](../server/api/enrollments/%5Bid%5D.delete.ts) | API endpoints | |
| 180 | [`server/api/enrollments/[id].get.ts`](../server/api/enrollments/%5Bid%5D.get.ts) | API endpoints | |
| 181 | [`server/api/enrollments/[id].put.ts`](../server/api/enrollments/%5Bid%5D.put.ts) | API endpoints | |
| 182 | [`server/api/enrollments/index.post.ts`](../server/api/enrollments/index.post.ts) | API endpoints | |

## `server/api/github`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 183 | [`server/api/github/connect.post.ts`](../server/api/github/connect.post.ts) | API endpoints | |
| 184 | [`server/api/github/create-repos.post.ts`](../server/api/github/create-repos.post.ts) | API endpoints | |
| 185 | [`server/api/github/disconnect.post.ts`](../server/api/github/disconnect.post.ts) | API endpoints | |
| 186 | [`server/api/github/status.get.ts`](../server/api/github/status.get.ts) | API endpoints | |

## `server/api/memberships`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 187 | [`server/api/memberships/[id].delete.ts`](../server/api/memberships/%5Bid%5D.delete.ts) | API endpoints | |
| 188 | [`server/api/memberships/[id].get.ts`](../server/api/memberships/%5Bid%5D.get.ts) | API endpoints | |
| 189 | [`server/api/memberships/index.post.ts`](../server/api/memberships/index.post.ts) | API endpoints | |

## `server/api/partners`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 190 | [`server/api/partners/[id].delete.ts`](../server/api/partners/%5Bid%5D.delete.ts) | API endpoints | |
| 191 | [`server/api/partners/[id].get.ts`](../server/api/partners/%5Bid%5D.get.ts) | API endpoints | |
| 192 | [`server/api/partners/[id].put.ts`](../server/api/partners/%5Bid%5D.put.ts) | API endpoints | |
| 193 | [`server/api/partners/index.get.ts`](../server/api/partners/index.get.ts) | API endpoints | |
| 194 | [`server/api/partners/index.post.ts`](../server/api/partners/index.post.ts) | API endpoints | |

## `server/api/projects`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 195 | [`server/api/projects/[id].delete.ts`](../server/api/projects/%5Bid%5D.delete.ts) | API endpoints | |
| 196 | [`server/api/projects/[id].get.ts`](../server/api/projects/%5Bid%5D.get.ts) | API endpoints | |
| 197 | [`server/api/projects/[id].put.ts`](../server/api/projects/%5Bid%5D.put.ts) | API endpoints | |
| 198 | [`server/api/projects/index.get.ts`](../server/api/projects/index.get.ts) | API endpoints | |
| 199 | [`server/api/projects/index.post.ts`](../server/api/projects/index.post.ts) | API endpoints | |

## `server/api/semesters`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 200 | [`server/api/semesters/[id].delete.ts`](../server/api/semesters/%5Bid%5D.delete.ts) | API endpoints | |
| 201 | [`server/api/semesters/[id].get.ts`](../server/api/semesters/%5Bid%5D.get.ts) | API endpoints | |
| 202 | [`server/api/semesters/[id].put.ts`](../server/api/semesters/%5Bid%5D.put.ts) | API endpoints | |
| 203 | [`server/api/semesters/index.get.ts`](../server/api/semesters/index.get.ts) | API endpoints | |
| 204 | [`server/api/semesters/index.post.ts`](../server/api/semesters/index.post.ts) | API endpoints | |

## `server/api/students`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 205 | [`server/api/students/[id].delete.ts`](../server/api/students/%5Bid%5D.delete.ts) | API endpoints | |
| 206 | [`server/api/students/[id].get.ts`](../server/api/students/%5Bid%5D.get.ts) | API endpoints | |
| 207 | [`server/api/students/[id].put.ts`](../server/api/students/%5Bid%5D.put.ts) | API endpoints | |
| 208 | [`server/api/students/index.get.ts`](../server/api/students/index.get.ts) | API endpoints | |
| 209 | [`server/api/students/index.post.ts`](../server/api/students/index.post.ts) | API endpoints | |

## `server/api/team-formation`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 210 | [`server/api/team-formation/bids.post.ts`](../server/api/team-formation/bids.post.ts) | API endpoints | |
| 211 | [`server/api/team-formation/generate.post.ts`](../server/api/team-formation/generate.post.ts) | API endpoints | |

## `server/api/teams`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 212 | [`server/api/teams/[id].delete.ts`](../server/api/teams/%5Bid%5D.delete.ts) | API endpoints | |
| 213 | [`server/api/teams/[id].get.ts`](../server/api/teams/%5Bid%5D.get.ts) | API endpoints | |
| 214 | [`server/api/teams/[id].put.ts`](../server/api/teams/%5Bid%5D.put.ts) | API endpoints | |
| 215 | [`server/api/teams/index.post.ts`](../server/api/teams/index.post.ts) | API endpoints | |

## `server/api/users`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 216 | [`server/api/users/[id].delete.ts`](../server/api/users/%5Bid%5D.delete.ts) | API endpoints | |
| 217 | [`server/api/users/[id].put.ts`](../server/api/users/%5Bid%5D.put.ts) | API endpoints | |
| 218 | [`server/api/users/index.get.ts`](../server/api/users/index.get.ts) | API endpoints | |
| 219 | [`server/api/users/upload.post.ts`](../server/api/users/upload.post.ts) | API endpoints | |

## `server/api/users/[id]`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 220 | [`server/api/users/[id]/profile.get.ts`](../server/api/users/%5Bid%5D/profile.get.ts) | API endpoints | |

## `server/integrations`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 221 | [`server/integrations/README.md`](../server/integrations/README.md) | Server services and helpers | |

## `server/integrations/discordBot`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 222 | [`server/integrations/discordBot/config.json`](../server/integrations/discordBot/config.json) | Server services and helpers | |
| 223 | [`server/integrations/discordBot/README.md`](../server/integrations/discordBot/README.md) | Server services and helpers | |

## `server/integrations/discordBot/src`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 224 | [`server/integrations/discordBot/src/index.ts`](../server/integrations/discordBot/src/index.ts) | Server services and helpers | |

## `server/integrations/discordBot/src/commands/misc`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 225 | [`server/integrations/discordBot/src/commands/misc/ping.ts`](../server/integrations/discordBot/src/commands/misc/ping.ts) | Server services and helpers | |

## `server/integrations/discordBot/src/commands/moderation`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 226 | [`server/integrations/discordBot/src/commands/moderation/addrole.ts`](../server/integrations/discordBot/src/commands/moderation/addrole.ts) | Server services and helpers | |
| 227 | [`server/integrations/discordBot/src/commands/moderation/ban.ts`](../server/integrations/discordBot/src/commands/moderation/ban.ts) | Server services and helpers | |
| 228 | [`server/integrations/discordBot/src/commands/moderation/createchannel.ts`](../server/integrations/discordBot/src/commands/moderation/createchannel.ts) | Server services and helpers | |
| 229 | [`server/integrations/discordBot/src/commands/moderation/kick.ts`](../server/integrations/discordBot/src/commands/moderation/kick.ts) | Server services and helpers | |
| 230 | [`server/integrations/discordBot/src/commands/moderation/removerole.ts`](../server/integrations/discordBot/src/commands/moderation/removerole.ts) | Server services and helpers | |
| 231 | [`server/integrations/discordBot/src/commands/moderation/syncChannels.ts`](../server/integrations/discordBot/src/commands/moderation/syncChannels.ts) | Server services and helpers | |
| 232 | [`server/integrations/discordBot/src/commands/moderation/timeout.ts`](../server/integrations/discordBot/src/commands/moderation/timeout.ts) | Server services and helpers | |

## `server/integrations/discordBot/src/events/guildMemberAdd`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 233 | [`server/integrations/discordBot/src/events/guildMemberAdd/syncMember.ts`](../server/integrations/discordBot/src/events/guildMemberAdd/syncMember.ts) | Server services and helpers | |

## `server/integrations/discordBot/src/events/interactionCreate`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 234 | [`server/integrations/discordBot/src/events/interactionCreate/handleCommands.ts`](../server/integrations/discordBot/src/events/interactionCreate/handleCommands.ts) | Server services and helpers | |

## `server/integrations/discordBot/src/events/ready`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 235 | [`server/integrations/discordBot/src/events/ready/01registerCommands.ts`](../server/integrations/discordBot/src/events/ready/01registerCommands.ts) | Server services and helpers | |
| 236 | [`server/integrations/discordBot/src/events/ready/consoleLog.ts`](../server/integrations/discordBot/src/events/ready/consoleLog.ts) | Server services and helpers | |

## `server/integrations/discordBot/src/handlers`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 237 | [`server/integrations/discordBot/src/handlers/eventHandler.ts`](../server/integrations/discordBot/src/handlers/eventHandler.ts) | Server services and helpers | |

## `server/integrations/discordBot/src/teambuilderFunc`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 238 | [`server/integrations/discordBot/src/teambuilderFunc/createProjectDiscord.ts`](../server/integrations/discordBot/src/teambuilderFunc/createProjectDiscord.ts) | Server services and helpers | |

## `server/integrations/discordBot/src/utils`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 239 | [`server/integrations/discordBot/src/utils/areCommandsDifferent.ts`](../server/integrations/discordBot/src/utils/areCommandsDifferent.ts) | Server services and helpers | |
| 240 | [`server/integrations/discordBot/src/utils/clientInstance.ts`](../server/integrations/discordBot/src/utils/clientInstance.ts) | Server services and helpers | |
| 241 | [`server/integrations/discordBot/src/utils/getAllFiles.ts`](../server/integrations/discordBot/src/utils/getAllFiles.ts) | Server services and helpers | |
| 242 | [`server/integrations/discordBot/src/utils/getApplicationCommands.ts`](../server/integrations/discordBot/src/utils/getApplicationCommands.ts) | Server services and helpers | |
| 243 | [`server/integrations/discordBot/src/utils/getLocalCommands.ts`](../server/integrations/discordBot/src/utils/getLocalCommands.ts) | Server services and helpers | |

## `server/integrations/github`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 244 | [`server/integrations/github/GithubManagement.ts`](../server/integrations/github/GithubManagement.ts) | Server services and helpers | |

## `server/middleware`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 245 | [`server/middleware/authMiddleware.ts`](../server/middleware/authMiddleware.ts) | Server services and helpers | |

## `server/plugins`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 246 | [`server/plugins/discordBot.ts`](../server/plugins/discordBot.ts) | Server services and helpers | |

## `server/services`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 247 | [`server/services/choiceService.ts`](../server/services/choiceService.ts) | Server services and helpers | |
| 248 | [`server/services/contactService.ts`](../server/services/contactService.ts) | Server services and helpers | |
| 249 | [`server/services/discordBotService.ts`](../server/services/discordBotService.ts) | Server services and helpers | |
| 250 | [`server/services/enrollmentService.ts`](../server/services/enrollmentService.ts) | Server services and helpers | |
| 251 | [`server/services/githubService.ts`](../server/services/githubService.ts) | Server services and helpers | |
| 252 | [`server/services/membershipService.ts`](../server/services/membershipService.ts) | Server services and helpers | |
| 253 | [`server/services/partnerService.ts`](../server/services/partnerService.ts) | Server services and helpers | |
| 254 | [`server/services/projectService.ts`](../server/services/projectService.ts) | Server services and helpers | |
| 255 | [`server/services/semesterService.ts`](../server/services/semesterService.ts) | Server services and helpers | |
| 256 | [`server/services/studentService.ts`](../server/services/studentService.ts) | Server services and helpers | |
| 257 | [`server/services/teamService.ts`](../server/services/teamService.ts) | Server services and helpers | |
| 258 | [`server/services/userService.ts`](../server/services/userService.ts) | Server services and helpers | |

## `server/services/CPSAT`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 259 | [`server/services/CPSAT/ortools.ts`](../server/services/CPSAT/ortools.ts) | Server services and helpers | |
| 260 | [`server/services/CPSAT/README_ORTOOLS.md`](../server/services/CPSAT/README_ORTOOLS.md) | Server services and helpers | |
| 261 | [`server/services/CPSAT/team_generator.py`](../server/services/CPSAT/team_generator.py) | Server services and helpers | |
| 262 | [`server/services/CPSAT/test.ts`](../server/services/CPSAT/test.ts) | Server services and helpers | |
| 263 | [`server/services/CPSAT/tsconfig.json`](../server/services/CPSAT/tsconfig.json) | Server services and helpers | |

## `server/utils`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 264 | [`server/utils/auth.ts`](../server/utils/auth.ts) | Server services and helpers | |
| 265 | [`server/utils/authz.ts`](../server/utils/authz.ts) | Server services and helpers | |
| 266 | [`server/utils/prisma.ts`](../server/utils/prisma.ts) | Server services and helpers | |
| 267 | [`server/utils/schemas.ts`](../server/utils/schemas.ts) | Server services and helpers | |

## `server/utils/ai`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 268 | [`server/utils/ai/academicReport.test.ts`](../server/utils/ai/academicReport.test.ts) | Tests | |
| 269 | [`server/utils/ai/academicReport.ts`](../server/utils/ai/academicReport.ts) | AI reporting | |
| 270 | [`server/utils/ai/academicReportConversation.ts`](../server/utils/ai/academicReportConversation.ts) | AI reporting | |
| 271 | [`server/utils/ai/academicReportData.ts`](../server/utils/ai/academicReportData.ts) | AI reporting | |
| 272 | [`server/utils/ai/askFlow.test.ts`](../server/utils/ai/askFlow.test.ts) | Tests | |
| 273 | [`server/utils/ai/askFlow.ts`](../server/utils/ai/askFlow.ts) | AI reporting | |
| 274 | [`server/utils/ai/auditReporting.test.ts`](../server/utils/ai/auditReporting.test.ts) | Tests | |
| 275 | [`server/utils/ai/harness.ts`](../server/utils/ai/harness.ts) | AI reporting | |
| 276 | [`server/utils/ai/privacyPolicy.test.ts`](../server/utils/ai/privacyPolicy.test.ts) | Tests | |
| 277 | [`server/utils/ai/privacyPolicy.ts`](../server/utils/ai/privacyPolicy.ts) | AI reporting | |
| 278 | [`server/utils/ai/queryExecutor.test.ts`](../server/utils/ai/queryExecutor.test.ts) | Tests | |
| 279 | [`server/utils/ai/queryExecutor.ts`](../server/utils/ai/queryExecutor.ts) | AI reporting | |
| 280 | [`server/utils/ai/queryPlan.test.ts`](../server/utils/ai/queryPlan.test.ts) | Tests | |
| 281 | [`server/utils/ai/queryPlan.ts`](../server/utils/ai/queryPlan.ts) | AI reporting | |
| 282 | [`server/utils/ai/questionText.ts`](../server/utils/ai/questionText.ts) | AI reporting | |
| 283 | [`server/utils/ai/reportPlanCacheAndShortcuts.ts`](../server/utils/ai/reportPlanCacheAndShortcuts.ts) | AI reporting | |
| 284 | [`server/utils/ai/schemaCatalog.ts`](../server/utils/ai/schemaCatalog.ts) | AI reporting | |
| 285 | [`server/utils/ai/structuredResponse.ts`](../server/utils/ai/structuredResponse.ts) | AI reporting | |

## `wpr/s1_fall26`

| # | File | Suggested category | Your notes |
| ---: | --- | --- | --- |
| 286 | [`wpr/s1_fall26/w1.md`](../wpr/s1_fall26/w1.md) | Documentation | |

## Framework-managed folders

- `.git/` stores Git history.
- `node_modules/` holds installed dependencies.
- `.nuxt/` and `.output/` contain generated development and build files.
