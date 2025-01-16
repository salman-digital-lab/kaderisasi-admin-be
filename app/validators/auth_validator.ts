import vine from '@vinejs/vine'

export const registerValidator = vine.compile(
  vine.object({
    displayName: vine.string(),
    email: vine.string().email(),
    password: vine.string(),
  })
)

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
    password: vine.string(),
  })
)

export const editPasswordValidator = vine.compile(
  vine.object({
    password: vine.string(),
    email: vine.string().email(),
  })
)

export const editAdminUser = vine.compile(
  vine.object({
    role_id: vine.number(),
  })
)
