import vine from '@vinejs/vine'

export const createMemberValidator = vine.compile(
  vine.object({
    name: vine.string(),
    email: vine.string().email().optional(),
    password: vine.string().optional(),
    member_id: vine.string().optional(),

    gender: vine.enum(['M', 'F']).optional(),
    personal_id: vine.string().optional(),
    whatsapp: vine.string().optional(),
    instagram: vine.string().optional(),
    tiktok: vine.string().optional(),
    linkedin: vine.string().optional(),
    line: vine.string().optional(),
    birth_date: vine.string().optional(),
    province_id: vine.number().optional(),
    city_id: vine.number().optional(),
    place_of_birth: vine.string().optional(),
    country: vine.string().optional(),
  })
)

export const generateAccountValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
    password: vine.string().minLength(8),
  })
)

export const regionalAssignmentValidator = vine.compile(
  vine.object({
    alumni_regional_assignment: vine.array(vine.string()),
  })
)
