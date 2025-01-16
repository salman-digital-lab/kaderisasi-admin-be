import vine from '@vinejs/vine'

export const storeRoleValidator = vine.compile(
  vine.object({
    role_name: vine.string(),
  })
)

export const storePermissionValidator = vine.compile(
  vine.object({
    permission_code: vine.string(),
  })
)

export const storeRolesPermissionValidator = vine.compile(
  vine.object({
    role_id: vine.number(),
    permission_id: vine.number(),
  })
)
