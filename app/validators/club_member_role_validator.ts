import vine from '@vinejs/vine'

export const storeClubMemberRoleValidator = vine.compile(
  vine.object({
    club_registration_id: vine.number().positive(),
    role_name: vine.string().trim().minLength(2).maxLength(150),
    start_date: vine.date().optional(),
    end_date: vine.date().optional(),
    is_primary: vine.boolean().optional(),
    sort_order: vine.number().optional(),
  })
)

export const updateClubMemberRoleValidator = vine.compile(
  vine.object({
    role_name: vine.string().trim().minLength(2).maxLength(150).optional(),
    start_date: vine.date().optional(),
    end_date: vine.date().optional(),
    is_primary: vine.boolean().optional(),
    sort_order: vine.number().optional(),
  })
)
