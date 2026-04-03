import vine from '@vinejs/vine'

export const updateProfileValidator = vine.compile(
  vine.object({
    name: vine.string().optional(),
    gender: vine.enum(['M', 'F']).optional(),
    personal_id: vine.string().optional(),
    badges: vine.string().optional(),

    whatsapp: vine.string().optional(),
    line: vine.string().optional(),
    instagram: vine.string().optional(),
    tiktok: vine.string().optional(),
    linkedin: vine.string().optional(),

    province_id: vine.number().optional(),
    city_id: vine.number().optional(),
    level: vine.number().optional(),
    birth_date: vine.string().optional(),
    password: vine.string().optional(),

    origin_province_id: vine.number().optional(),
    origin_city_id: vine.number().optional(),
    country: vine.string().optional(),
    education_history: vine
      .array(
        vine.object({
          degree: vine.enum(['bachelor', 'master', 'doctoral']),
          institution: vine.string(),
          major: vine.string(),
          intake_year: vine.number(),
        })
      )
      .optional(),
    work_history: vine
      .array(
        vine.object({
          job: vine.string(),
          organization: vine.string(),
          role: vine.string(),
          description: vine.string().optional(),
        })
      )
      .optional(),
    extra_data: vine
      .object({
        preferred_name: vine.string().optional(),
        salman_activity_history: vine.array(vine.string()).optional(),
        current_activity_focus: vine
          .array(
            vine.enum(['professional', 'academic', 'social', 'entrepreneur', 'politics', 'other'])
          )
          .optional(),
        alumni_regional_assignment: vine.array(vine.string()).optional(),
      })
      .optional(),
  })
)
