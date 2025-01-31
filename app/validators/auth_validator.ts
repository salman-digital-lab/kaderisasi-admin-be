import vine from '@vinejs/vine'

export const registerValidator = vine.compile(
  vine.object({
    displayName: vine.string(),
    email: vine.string().email(),
    password: vine.string(),
    role: vine.number(),
  })
)

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
    password: vine.string(),
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
    role: vine.number(),
  })
)
