
<a id="file--dockerignore"></a>

## `.dockerignore`

**Purpose**

Provide the .dockerignore project resource.

**Inputs**

- The values or content stored in this file.

**Outputs**

- A resource read by the relevant project tool.

**Pseudocode**

Locate the file → read it with the appropriate tool → use its contents in the project.

<a id="file--env"></a>

## `.env`

**Purpose**

Supply private runtime settings for this local app.

**Inputs**

- Database connection and private service settings.

**Outputs**

- Environment variables read by the running server.

**Pseudocode**

Load the local settings → read the database and service configuration → start the app.

<a id="file--env-example"></a>

## `.env.example`

**Purpose**

Provide the .env project resource.

**Inputs**

- The values or content stored in this file.

**Outputs**

- A resource read by the relevant project tool.

**Pseudocode**

Locate the file → read it with the appropriate tool → use its contents in the project.

<a id="file--gitignore"></a>

## `.gitignore`

**Purpose**

Provide the .gitignore project resource.

**Inputs**

- The values or content stored in this file.

**Outputs**

- A resource read by the relevant project tool.

**Pseudocode**

Locate the file → read it with the appropriate tool → use its contents in the project.

<a id="file--prettierignore"></a>

## `.prettierignore`

**Purpose**

Provide the .prettierignore project resource.

**Inputs**

- The values or content stored in this file.

**Outputs**

- A resource read by the relevant project tool.

**Pseudocode**

Locate the file → read it with the appropriate tool → use its contents in the project.

<a id="file--prettierrc"></a>

## `.prettierrc`

**Purpose**

Provide the .prettierrc project resource.

**Inputs**

- The values or content stored in this file.

**Outputs**

- A resource read by the relevant project tool.

**Pseudocode**

Locate the file → read it with the appropriate tool → use its contents in the project.

<a id="file-claude-md"></a>

## `CLAUDE.md`

**Purpose**

Explain CLAUDE for people working on ESA.

**Inputs**

- Project decisions, instructions, or examples.

**Outputs**

- Written reference material for developers.

**Pseudocode**

Open the relevant section → read the explanation → follow or verify the instructions.

<a id="file-dev-before-fall2026-db"></a>

## `dev-before-fall2026.db`

**Purpose**

Store ESA records in a SQLite database.

**Inputs**

- Writes made through the app or import tooling.

**Outputs**

- Data returned to queries and services.

**Pseudocode**

Open the database → query or update rows through the data layer.

<a id="file-dev-before-source-cleanup-db"></a>

## `dev-before-source-cleanup.db`

**Purpose**

Store ESA records in a SQLite database.

**Inputs**

- Writes made through the app or import tooling.

**Outputs**

- Data returned to queries and services.

**Pseudocode**

Open the database → query or update rows through the data layer.

<a id="file-dev-db"></a>

## `dev.db`

**Purpose**

Store ESA records in a SQLite database.

**Inputs**

- Writes made through the app or import tooling.

**Outputs**

- Data returned to queries and services.

**Pseudocode**

Open the database → query or update rows through the data layer.

<a id="file-dockerfile"></a>

## `Dockerfile`

**Purpose**

Provide the Dockerfile project resource.

**Inputs**

- The values or content stored in this file.

**Outputs**

- A resource read by the relevant project tool.

**Pseudocode**

Locate the file → read it with the appropriate tool → use its contents in the project.

<a id="file-nuxt-config-ts"></a>

## `nuxt.config.ts`

**Purpose**

Run or define the nuxt.config behavior.

**Inputs**

- Values supplied by callers, imports, or configuration.

**Outputs**

- Exported values, actions, or a route response.

**Pseudocode**

Load dependencies → evaluate the code’s rules → return or expose the result.

<a id="file-package-json"></a>

## `package.json`

**Purpose**

Describe the app’s dependencies and developer commands.

**Inputs**

- Package names, versions, and command definitions.

**Outputs**

- Configuration read by the package manager.

**Pseudocode**

Read the scripts → resolve dependencies → run the selected command.

<a id="file-pnpm-lock-yaml"></a>

## `pnpm-lock.yaml`

**Purpose**

Record the exact dependency versions for reproducible installations.

**Inputs**

- The dependency requirements from package.json.

**Outputs**

- Exact versions and integrity information used by pnpm.

**Pseudocode**

Read the locked versions → fetch the packages → install the same dependency tree.

<a id="file-pnpm-workspace-yaml"></a>

## `pnpm-workspace.yaml`

**Purpose**

Provide the pnpm workspace project resource.

**Inputs**

- The values or content stored in this file.

**Outputs**

- A resource read by the relevant project tool.

**Pseudocode**

Locate the file → read it with the appropriate tool → use its contents in the project.

<a id="file-prisma-config-ts"></a>

## `prisma.config.ts`

**Purpose**

Run or define the prisma.config behavior.

**Inputs**

- Values supplied by callers, imports, or configuration.

**Outputs**

- Exported values, actions, or a route response.

**Pseudocode**

Load dependencies → evaluate the code’s rules → return or expose the result.

<a id="file-readme-md"></a>

## `README.md`

**Purpose**

Explain README for people working on ESA.

**Inputs**

- Project decisions, instructions, or examples.

**Outputs**

- Written reference material for developers.

**Pseudocode**

Open the relevant section → read the explanation → follow or verify the instructions.

<a id="file-requirements-md"></a>

## `requirements.md`

**Purpose**

Explain requirements for people working on ESA.

**Inputs**

- Project decisions, instructions, or examples.

**Outputs**

- Written reference material for developers.

**Pseudocode**

Open the relevant section → read the explanation → follow or verify the instructions.

<a id="file-tsconfig-json"></a>

## `tsconfig.json`

**Purpose**

Store structured tsconfig data or configuration.

**Inputs**

- Recorded data or declared configuration values.

**Outputs**

- Values read by the tools that load this file.

**Pseudocode**

Parse the JSON → read the named keys → pass the values to the consuming tool.
