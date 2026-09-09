import vine from '@vinejs/vine'
import { ADMIN_ROLE_CODES } from '#constants/admin_roles'

export const createAccessRequestValidator = vine.compile(
  vine.object({
    role_code: vine.enum(ADMIN_ROLE_CODES),
    reason: vine.string().trim().minLength(3).maxLength(4000),
  })
)

export const rejectTicketValidator = vine.compile(
  vine.object({
    rejection_reason: vine.string().trim().minLength(3).maxLength(4000),
  })
)
