import vine from '@vinejs/vine'

export const updateAchievementValidator = vine.compile(
  vine.object({
    name: vine.string().optional(),
    description: vine.string().optional(),
    type: vine.number().withoutDecimals().optional(),
    score: vine.number().withoutDecimals().positive().optional(),
    proof: vine.string().optional(),
    status: vine.number().withoutDecimals().optional(),
    remark: vine.string().optional(),
  })
) 