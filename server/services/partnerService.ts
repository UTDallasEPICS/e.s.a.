/**
 * Purpose
 * Provide the partner service logic used by other parts of ESA.
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
import type { ContactCreate, ContactRead } from '#server/services/contactService'
import { prisma } from '#server/utils/prisma'

export interface PartnerProjectRead {
  id: string
  name: string
  Teams: { id: string; semesterId: string }[]
}

export interface PartnerRead {
  id: string
  name: string
  Contacts: ContactRead[]
  Projects: PartnerProjectRead[]
}

export interface PartnerCreate {
  name: string
  Contacts?: Omit<ContactCreate, 'partnerId'>[]
}

export interface PartnerUpdate {
  name?: string
}

// Define PARTNER_INCLUDE for the steps below.
const PARTNER_INCLUDE = {
  Contacts: true,
  Projects: { include: { Teams: { select: { id: true, semesterId: true } } } },
} as const

// Define getAllPartners for the steps below.
const getAllPartners = async (semesterId?: string): Promise<PartnerRead[]> => {
  // Define partners for the steps below.
  const partners = await prisma.partner.findMany({
    where: semesterId ? { Projects: { some: { Teams: { some: { semesterId } } } } } : undefined,
    orderBy: { name: 'asc' },
    include: PARTNER_INCLUDE,
  })
  // Pass partners back to the caller.
  return partners
}

// Define getPartnerById for the steps below.
const getPartnerById = async (id: string): Promise<PartnerRead | null> => {
  // Define partner for the steps below.
  const partner = await prisma.partner.findUnique({
    where: { id },
    include: PARTNER_INCLUDE,
  })
  // Pass partner back to the caller.
  return partner
}

// Define createPartner for the steps below.
const createPartner = async (data: PartnerCreate): Promise<PartnerRead> => {
  // Define { Contacts, ...rest } for the steps below.
  const { Contacts, ...rest } = data
  // Define partner for the steps below.
  const partner = await prisma.partner.create({
    data: {
      ...rest,
      Contacts: Contacts
        ? { create: Contacts.map((contact, index) => ({ ...contact, isPrimary: index === 0 })) }
        : undefined,
    },
    include: PARTNER_INCLUDE,
  })
  // Pass partner back to the caller.
  return partner
}

// Define updatePartner for the steps below.
const updatePartner = async (id: string, data: PartnerUpdate): Promise<PartnerRead> => {
  // Define partner for the steps below.
  const partner = await prisma.partner.update({
    where: { id },
    data,
    include: PARTNER_INCLUDE,
  })
  // Pass partner back to the caller.
  return partner
}

// Define deletePartner for the steps below.
const deletePartner = async (id: string): Promise<void> => {
  await prisma.partner.delete({ where: { id } })
}

// Define partnerService for the steps below.
const partnerService = {
  getAllPartners,
  getPartnerById,
  createPartner,
  updatePartner,
  deletePartner,
}

export default partnerService
