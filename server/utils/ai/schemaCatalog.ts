/**
 * Purpose
 * Provide the schema catalog logic used by other parts of ESA.
 *
 * Inputs
 * - Values passed by callers and any configuration or records imported here.
 *
 * Outputs
 * - The values, types, or functions exported by this file.
 *
 * Pseudocode
 * Load the dependencies → define the file’s rules or helpers → expose them for other files to use.
 */
import * as PrismaEnums from '../../../prisma/generated/enums'
import { prisma } from '../prisma'

export type AIModelName = 'Project' | 'Partner' | 'Team' | 'Semester'
export type AIValueType = 'String' | 'Int' | 'Float' | 'Boolean' | 'DateTime' | string
export type AIAggregateFunction = 'count' | 'countDistinct' | 'sum' | 'avg' | 'min' | 'max'

export type AIScalarField = {
  name: string
  type: AIValueType
  kind: 'scalar' | 'enum'
  enumValues?: string[]
  capabilities: {
    select: true
    filter: true
    group: true
    sort: true
    aggregate: AIAggregateFunction[]
  }
}

export type AIRelation = {
  name: string
  target: AIModelName
  cardinality: 'one' | 'many'
  relationName: string
}

export type AIModelMetadata = {
  name: AIModelName
  fields: Record<string, AIScalarField>
  relations: Record<string, AIRelation>
}

export type AISchemaCatalog = Record<AIModelName, AIModelMetadata>

type RuntimeField = {
  name: string
  kind: 'scalar' | 'enum' | 'object'
  type: string
  relationName?: string
}

type RuntimeDataModel = {
  models: Record<string, { fields: RuntimeField[] }>
}

type ModelPolicy = {
  fields: readonly string[]
  relations: Readonly<Record<string, { target: AIModelName; cardinality: 'one' | 'many' }>>
}

// This is the security boundary: Prisma metadata confirms structure, while this
// policy decides what the AI query planner may name. Student and auth models,
// contacts, and relationships that expose student or contact data stay excluded.
const approvedPolicy: Record<AIModelName, ModelPolicy> = {
  Project: {
    fields: ['id', 'name', 'description', 'type', 'status', 'repoURL', 'createdAt', 'updatedAt'],
    relations: {
      Partner: { target: 'Partner', cardinality: 'one' },
      Teams: { target: 'Team', cardinality: 'many' },
    },
  },
  Partner: {
    fields: ['id', 'name', 'createdAt', 'updatedAt'],
    relations: { Projects: { target: 'Project', cardinality: 'many' } },
  },
  Team: {
    fields: ['id', 'meetingDay', 'createdAt', 'updatedAt'],
    relations: {
      Semester: { target: 'Semester', cardinality: 'one' },
      Project: { target: 'Project', cardinality: 'one' },
    },
  },
  Semester: {
    fields: ['id', 'year', 'season', 'createdAt', 'updatedAt'],
    relations: { Teams: { target: 'Team', cardinality: 'many' } },
  },
}

// Define enumMetadata for the steps below.
const enumMetadata = PrismaEnums as unknown as Record<string, Record<string, string>>
// Define runtimeDataModel for the steps below.
const runtimeDataModel = (prisma as unknown as { _runtimeDataModel: RuntimeDataModel })
  ._runtimeDataModel

// Define the helper that will aggregate capabilities.
function aggregateCapabilities(type: string): AIAggregateFunction[] {
  // Define functions for the steps below.
  const functions: AIAggregateFunction[] = ['count', 'countDistinct']
  // Check whether type === 'Int' || type === 'Float' || type === 'BigInt' || type === 'Decimal' before running this branch.
  if (type === 'Int' || type === 'Float' || type === 'BigInt' || type === 'Decimal') {
    // Call functions.push to run this step.
    functions.push('sum', 'avg')
  }
  // Check whether type === 'Int' || type === 'Float' || type === 'BigInt' || type === 'Decimal' || type === 'String' | before running this branch.
  if (
    type === 'Int' ||
    type === 'Float' ||
    type === 'BigInt' ||
    type === 'Decimal' ||
    type === 'String' ||
    type === 'DateTime'
  ) {
    // Call functions.push to run this step.
    functions.push('min', 'max')
  }
  // Pass functions back to the caller.
  return functions
}

// Define the helper that will build aischema catalog.
export function buildAISchemaCatalog(metadata: RuntimeDataModel): AISchemaCatalog {
  // Define catalog for the steps below.
  const catalog = {} as AISchemaCatalog

  // Repeat the following steps for each item in Object.entries(approvedPolicy) as [AIModelName, ModelPolicy][].
  for (const [modelName, policy] of Object.entries(approvedPolicy) as [AIModelName, ModelPolicy][]) {
    // Define runtimeModel for the steps below.
    const runtimeModel = metadata.models[modelName]
    // Check whether !runtimeModel before running this branch.
    if (!runtimeModel) throw new Error(`Approved AI model is missing from Prisma metadata: ${modelName}`)

    // Define fields for the steps below.
    const fields: Record<string, AIScalarField> = {}
    // Repeat the following steps for each item in policy.fields.
    for (const fieldName of policy.fields) {
      // Use runtimeModel.fields.find to initialize runtimeField.
      const runtimeField = runtimeModel.fields.find((field) => field.name === fieldName)
      // Check whether !runtimeField || !['scalar', 'enum'].includes(runtimeField.kind) before running this branch.
      if (!runtimeField || !['scalar', 'enum'].includes(runtimeField.kind)) {
        // Stop this operation and tell the caller why it cannot continue.
        throw new Error(`Approved AI field is missing or not scalar: ${modelName}.${fieldName}`)
      }
      // Define enumValues for the steps below.
      const enumValues =
        runtimeField.kind === 'enum' ? Object.values(enumMetadata[runtimeField.type] ?? {}) : undefined
      // Check whether runtimeField.kind === 'enum' && (!enumValues || enumValues.length === 0) before running this branch.
      if (runtimeField.kind === 'enum' && (!enumValues || enumValues.length === 0)) {
        // Stop this operation and tell the caller why it cannot continue.
        throw new Error(`Prisma enum metadata is missing: ${runtimeField.type}`)
      }
      // Update fields[fieldName] with the value on the right.
      fields[fieldName] = {
        name: fieldName,
        type: runtimeField.type,
        kind: runtimeField.kind,
        ...(enumValues ? { enumValues } : {}),
        capabilities: {
          select: true,
          filter: true,
          group: true,
          sort: true,
          aggregate: aggregateCapabilities(runtimeField.type),
        },
      }
    }

    // Define relations for the steps below.
    const relations: Record<string, AIRelation> = {}
    // Repeat the following steps for each item in Object.entries(policy.relations).
    for (const [relationName, relationPolicy] of Object.entries(policy.relations)) {
      // Use runtimeModel.fields.find to initialize runtimeRelation.
      const runtimeRelation = runtimeModel.fields.find((field) => field.name === relationName)
      // Check whether !runtimeRelation || runtimeRelation.kind !== 'object' || runtimeRelation.type !== relationPolicy.tar before running this branch.
      if (
        !runtimeRelation ||
        runtimeRelation.kind !== 'object' ||
        runtimeRelation.type !== relationPolicy.target ||
        !runtimeRelation.relationName
      ) {
        // Stop this operation and tell the caller why it cannot continue.
        throw new Error(`Approved AI relation is missing or changed: ${modelName}.${relationName}`)
      }
      // Update relations[relationName] with the value on the right.
      relations[relationName] = {
        name: relationName,
        target: relationPolicy.target,
        cardinality: relationPolicy.cardinality,
        relationName: runtimeRelation.relationName,
      }
    }

    // Update catalog[modelName] with the value on the right.
    catalog[modelName] = { name: modelName, fields, relations }
  }
  // Pass catalog back to the caller.
  return catalog
}

// Use buildAISchemaCatalog to initialize aiSchemaCatalog.
export const aiSchemaCatalog = buildAISchemaCatalog(runtimeDataModel)

// Define the helper that will resolve aifield path.
export function resolveAIFieldPath(modelName: AIModelName, path: string): AIScalarField | undefined {
  // Use path.split to initialize segments.
  const segments = path.split('.')
  // Check whether segments.length < 1 || segments.length > 5 || segments.some((segment) => !segment) before running this branch.
  if (segments.length < 1 || segments.length > 5 || segments.some((segment) => !segment)) {
    // Pass undefined back to the caller.
    return undefined
  }
  // Define model for the steps below.
  let model = aiSchemaCatalog[modelName]
  // Repeat the following steps for each item in segments.entries().
  for (const [index, segment] of segments.entries()) {
    // Define field for the steps below.
    const field = model.fields[segment]
    // Check whether field before running this branch.
    if (field) return index === segments.length - 1 ? field : undefined
    // Check whether index === segments.length - 1 before running this branch.
    if (index === segments.length - 1) return undefined
    // Define relation for the steps below.
    const relation = model.relations[segment]
    // Check whether !relation before running this branch.
    if (!relation) return undefined
    // Update model with the value on the right.
    model = aiSchemaCatalog[relation.target]
  }
  // Pass undefined back to the caller.
  return undefined
}

// Define the helper that will resolve airelation.
export function resolveAIRelation(modelName: AIModelName, relationName: string): AIRelation | undefined {
  // Pass aiSchemaCatalog[modelName].relations[relationName] back to the caller.
  return aiSchemaCatalog[modelName].relations[relationName]
}
