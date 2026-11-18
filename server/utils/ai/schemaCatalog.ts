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

const enumMetadata = PrismaEnums as unknown as Record<string, Record<string, string>>
const runtimeDataModel = (prisma as unknown as { _runtimeDataModel: RuntimeDataModel })
  ._runtimeDataModel

function aggregateCapabilities(type: string): AIAggregateFunction[] {
  const functions: AIAggregateFunction[] = ['count', 'countDistinct']
  if (type === 'Int' || type === 'Float' || type === 'BigInt' || type === 'Decimal') {
    functions.push('sum', 'avg')
  }
  if (
    type === 'Int' ||
    type === 'Float' ||
    type === 'BigInt' ||
    type === 'Decimal' ||
    type === 'String' ||
    type === 'DateTime'
  ) {
    functions.push('min', 'max')
  }
  return functions
}

export function buildAISchemaCatalog(metadata: RuntimeDataModel): AISchemaCatalog {
  const catalog = {} as AISchemaCatalog

  for (const [modelName, policy] of Object.entries(approvedPolicy) as [AIModelName, ModelPolicy][]) {
    const runtimeModel = metadata.models[modelName]
    if (!runtimeModel) throw new Error(`Approved AI model is missing from Prisma metadata: ${modelName}`)

    const fields: Record<string, AIScalarField> = {}
    for (const fieldName of policy.fields) {
      const runtimeField = runtimeModel.fields.find((field) => field.name === fieldName)
      if (!runtimeField || !['scalar', 'enum'].includes(runtimeField.kind)) {
        throw new Error(`Approved AI field is missing or not scalar: ${modelName}.${fieldName}`)
      }
      const enumValues =
        runtimeField.kind === 'enum' ? Object.values(enumMetadata[runtimeField.type] ?? {}) : undefined
      if (runtimeField.kind === 'enum' && (!enumValues || enumValues.length === 0)) {
        throw new Error(`Prisma enum metadata is missing: ${runtimeField.type}`)
      }
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

    const relations: Record<string, AIRelation> = {}
    for (const [relationName, relationPolicy] of Object.entries(policy.relations)) {
      const runtimeRelation = runtimeModel.fields.find((field) => field.name === relationName)
      if (
        !runtimeRelation ||
        runtimeRelation.kind !== 'object' ||
        runtimeRelation.type !== relationPolicy.target ||
        !runtimeRelation.relationName
      ) {
        throw new Error(`Approved AI relation is missing or changed: ${modelName}.${relationName}`)
      }
      relations[relationName] = {
        name: relationName,
        target: relationPolicy.target,
        cardinality: relationPolicy.cardinality,
        relationName: runtimeRelation.relationName,
      }
    }

    catalog[modelName] = { name: modelName, fields, relations }
  }
  return catalog
}

export const aiSchemaCatalog = buildAISchemaCatalog(runtimeDataModel)

export function resolveAIFieldPath(modelName: AIModelName, path: string): AIScalarField | undefined {
  const segments = path.split('.')
  if (segments.length < 1 || segments.length > 5 || segments.some((segment) => !segment)) {
    return undefined
  }
  let model = aiSchemaCatalog[modelName]
  for (const [index, segment] of segments.entries()) {
    const field = model.fields[segment]
    if (field) return index === segments.length - 1 ? field : undefined
    if (index === segments.length - 1) return undefined
    const relation = model.relations[segment]
    if (!relation) return undefined
    model = aiSchemaCatalog[relation.target]
  }
  return undefined
}

export function resolveAIRelation(modelName: AIModelName, relationName: string): AIRelation | undefined {
  return aiSchemaCatalog[modelName].relations[relationName]
}
