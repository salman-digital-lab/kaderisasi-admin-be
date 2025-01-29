import vine from '@vinejs/vine'

export const activityValidator = vine.compile(
  vine.object({
    name: vine.string(),
    slug: vine.string(),
    description: vine.string().optional(),
    activity_start: vine.date().optional(),
    activity_end: vine.date().afterField('activity_start').optional(),
    registration_start: vine.date().optional(),
    registration_end: vine.date().afterField('registration_start').optional(),
    selection_start: vine.date().optional(),
    selection_end: vine.date().afterField('selection_start').optional(),
    minimum_level: vine.number().withoutDecimals().positive().optional(),
    activity_type: vine.number().withoutDecimals().positive().optional(),
    additional_config: vine
      .object({
        custom_selection_status: vine.array(vine.string()),
        mandatory_profile_data: vine.array(
          vine.object({ name: vine.string(), required: vine.boolean() })
        ),
        additional_questionnaire: vine.array(vine.any()),
      })
      .optional(),
    is_published: vine.number().optional(),
    activity_category: vine.number().withoutDecimals().positive().optional(),
    badge: vine.string().optional(),
  })
)

export const updateActivityValidator = vine.compile(
  vine.object({
    name: vine.string().optional(),
    slug: vine.string().optional(),
    description: vine.string().optional(),
    activity_start: vine.date().optional(),
    activity_end: vine.date().afterField('activity_start').optional(),
    registration_start: vine.date().optional(),
    registration_end: vine.date().afterField('registration_start').optional(),
    selection_start: vine.date().optional(),
    selection_end: vine.date().afterField('selection_start').optional(),
    minimum_level: vine.number().withoutDecimals().positive().optional(),
    activity_type: vine.number().withoutDecimals().positive().optional(),
    additional_config: vine
      .object({
        custom_selection_status: vine.array(vine.string()),
        mandatory_profile_data: vine.array(
          vine.object({ name: vine.string(), required: vine.boolean() })
        ),
        additional_questionnaire: vine.array(vine.any()),
      })
      .optional(),
    is_published: vine.number().optional(),
    activity_category: vine.number().withoutDecimals().positive().optional(),
    badge: vine.string().optional(),
  })
)

export const imageValidator = vine.compile(
  vine.object({
    file: vine.file({
      size: '2mb',
      extnames: ['jpg', 'png', 'jpeg', 'PNG', 'JPG', 'JPEG'],
    }),
  })
)

export const storeActivityRegistration = vine.compile(
  vine.object({
    user_id: vine.number(),
    questionnaire_answer: vine.record(vine.any()),
  })
)

export const updateActivityRegistrations = vine.compile(
  vine.object({
    status: vine.string(),
    registrations_id: vine.array(vine.number()),
  })
)

export const bulkUpdateActivityRegistrations = vine.compile(
  vine.object({
    name: vine.string().optional(),
    current_status: vine.string().optional(),
    new_status: vine.string(),
  })
)
