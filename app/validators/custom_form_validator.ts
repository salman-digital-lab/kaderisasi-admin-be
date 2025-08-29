import vine from '@vinejs/vine'

export const customFormValidator = vine.compile(
  vine.object({
    formName: vine.string().trim().minLength(1).maxLength(255),
    formDescription: vine.string().trim().optional(),
    featureType: vine.enum(['activity_registration', 'club_registration']).optional(),
    featureId: vine.number().positive().optional(),
    formSchema: vine.object({
      fields: vine.array(
        vine.object({
          section_name: vine.string().trim().minLength(1),
          fields: vine.array(
            vine.object({
              key: vine.string().trim().minLength(1),
              label: vine.string().trim().minLength(1),
              required: vine.boolean(),
              type: vine.string().trim().minLength(1),
              placeholder: vine.string().optional(),
              helpText: vine.string().optional(),
              description: vine.string().optional(),
              options: vine.array(
                vine.object({
                  label: vine.string().trim().minLength(1),
                  value: vine.any(),
                  disabled: vine.boolean().optional(),
                })
              ).optional(),
              validation: vine.object({
                min: vine.number().optional(),
                max: vine.number().optional(),
                minLength: vine.number().optional(),
                maxLength: vine.number().optional(),
                pattern: vine.string().optional(),
                customMessage: vine.string().optional(),
              }).optional(),
              defaultValue: vine.any().optional(),
              hidden: vine.boolean().optional(),
              disabled: vine.boolean().optional(),
            })
          ),
        })
      ),
    }).optional(),
    isActive: vine.boolean().optional(),
  })
)

export const updateCustomFormValidator = vine.compile(
  vine.object({
    formName: vine.string().trim().minLength(1).maxLength(255).optional(),
    formDescription: vine.string().trim().optional(),
    featureType: vine.enum(['activity_registration', 'club_registration']).optional(),
    featureId: vine.number().positive().optional(),
    formSchema: vine
      .object({
        fields: vine.array(
          vine.object({
            section_name: vine.string().trim().minLength(1),
            fields: vine.array(
              vine.object({
                key: vine.string().trim().minLength(1),
                label: vine.string().trim().minLength(1),
                required: vine.boolean(),
                type: vine.string().trim().minLength(1),
                placeholder: vine.string().optional(),
                helpText: vine.string().optional(),
                description: vine.string().optional(),
                options: vine.array(
                  vine.object({
                    label: vine.string().trim().minLength(1),
                    value: vine.any(),
                    disabled: vine.boolean().optional(),
                  })
                ).optional(),
                validation: vine.object({
                  min: vine.number().optional(),
                  max: vine.number().optional(),
                  minLength: vine.number().optional(),
                  maxLength: vine.number().optional(),
                  pattern: vine.string().optional(),
                  customMessage: vine.string().optional(),
                }).optional(),
                defaultValue: vine.any().optional(),
                hidden: vine.boolean().optional(),
                disabled: vine.boolean().optional(),
              })
            ),
          })
        ),
      })
      .optional(),
    isActive: vine.boolean().optional(),
  })
)
