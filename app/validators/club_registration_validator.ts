import vine from '@vinejs/vine'

export const storeClubRegistrationValidator = vine.compile(
  vine.object({
    member_id: vine.number().positive(),
    additional_data: vine.record(vine.any()).optional(),
  })
)

export const updateClubRegistrationValidator = vine.compile(
  vine.object({
    status: vine.enum(['PENDING', 'APPROVED', 'REJECTED']),
    additional_data: vine.record(vine.any()).optional(),
  })
)

export const bulkUpdateClubRegistrationsValidator = vine.compile(
  vine.object({
    registrations: vine.array(
      vine.object({
        id: vine.number().positive(),
        status: vine.enum(['PENDING', 'APPROVED', 'REJECTED']),
        additional_data: vine.record(vine.any()).optional(),
      })
    ),
  })
)

export const updateClubRegistrationInfoValidator = vine.compile(
  vine.object({
    registration_info: vine.string().trim().optional(),
    after_registration_info: vine.string().trim().optional(),
  })
)
