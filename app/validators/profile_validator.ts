import vine from '@vinejs/vine'

export const updateProfileValidator = vine.compile(
  vine.object({
    name: vine.string().optional(),
    gender: vine.enum(['M', 'F']).optional(),
    personal_id: vine.string().optional(),

    whatsapp: vine.string().optional(),
    line: vine.string().optional(),
    instagram: vine.string().optional(),
    tiktok: vine.string().optional(),
    linkedin: vine.string().optional(),

    province_id: vine.number().optional(),
    city_id: vine.number().optional(),
    university_id: vine.number().optional(),
    intake_year: vine.number().optional(),
    major: vine.string().optional(),
    level: vine.number().optional(),
    password: vine.string().optional(),
  })
)
