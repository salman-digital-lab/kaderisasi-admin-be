import vine from '@vinejs/vine'

export const UpdateRuangCurhatValidator = vine.compile(
  vine.object({
    counselor_id: vine.number().optional(),
    status: vine.number().optional(),
    additional_notes: vine.string().optional(),
  })
)
