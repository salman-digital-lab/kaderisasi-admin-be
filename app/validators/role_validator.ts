import vine from '@vinejs/vine'

export const storeRoleValidator = vine.compile(
  vine.object({
    role_name: vine.string(),
  })
)
