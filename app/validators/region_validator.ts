import vine from '@vinejs/vine'

export const provinceValidator = vine.compile(
  vine.object({
    name: vine.string(),
  })
)

export const cityValidator = vine.compile(
  vine.object({
    province_id: vine.number().optional(),
    name: vine.string(),
  })
)
