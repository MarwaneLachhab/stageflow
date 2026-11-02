import { z } from 'zod'

export const supportTicketSchema = z.object({
  subject: z.string().trim().min(3, 'Le sujet est requis.').max(160),
  category: z.string().trim().min(2).max(40),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  description: z.string().trim().min(10, 'Décrivez le problème en au moins 10 caractères.').max(5000),
})

export const supportMessageSchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().min(1, 'Le message est requis.').max(5000),
})

export const adminInviteSchema = z.object({
  email: z.string().trim().email('Adresse e-mail invalide.').max(254),
  firstName: z.string().trim().min(1, 'Le prénom est requis.').max(60),
  lastName: z.string().trim().min(1, 'Le nom est requis.').max(60),
})

export type SupportTicketInput = z.infer<typeof supportTicketSchema>
