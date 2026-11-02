import { z } from 'zod'

export const organizationSchema = z.object({
  name: z.string().trim().min(2).max(160),
  kind: z.string().trim().min(2).max(40),
  description: z.string().trim().max(5000).default(''),
  website: z.string().trim().url('URL invalide.').optional().or(z.literal('')),
  email: z.string().trim().email('Adresse e-mail invalide.').optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  address: z.string().trim().max(200).optional().or(z.literal('')),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  logoUrl: z.string().trim().url('URL du logo invalide.').optional().or(z.literal('')),
})

export const offerSchema = z.object({
  organizationId: z.string().uuid(),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(20).max(5000),
  domain: z.string().trim().min(2).max(80),
  stageType: z.string().trim().min(2).max(80),
  mode: z.string().trim().min(2).max(40),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  startsOn: z.string().optional().or(z.literal('')),
  endsOn: z.string().optional().or(z.literal('')),
  deadline: z.string().optional().or(z.literal('')),
  capacity: z.coerce.number().int().min(1).max(10000),
  published: z.boolean().default(false),
})
