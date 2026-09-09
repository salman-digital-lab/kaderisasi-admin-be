import vine from '@vinejs/vine'
import { ADMIN_ROLE_CODES } from '#constants/admin_roles'

export const registerValidator = vine.compile(
  vine.object({
    displayName: vine.string(),
    email: vine.string().email(),
    password: vine.string(),
    role_code: vine.enum(ADMIN_ROLE_CODES).nullable().optional(),
  })
)

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
    password: vine.string(),
  })
)

export const googleLoginValidator = vine.compile(
  vine.object({
    credential: vine.string().trim().minLength(20),
  })
)

export const editPublicUserValidator = vine.compile(
  vine.object({
    email: vine.string().email().optional(),
    password: vine.string().optional(),
  })
)

export const editPasswordValidator = vine.compile(
  vine.object({
    password: vine.string(),
  })
)

export const editAdminUser = vine.compile(
  vine.object({
    role_code: vine.enum(ADMIN_ROLE_CODES).nullable().optional(),
    isActive: vine.boolean().optional(),
  })
)
