import vine from '@vinejs/vine'

export const clubValidator = vine.compile(
  vine.object({
    name: vine.string(),
    club_type: vine.enum(['UKM', 'AVISMAN']).optional(),
    description: vine.string().optional(),
    short_description: vine.string().maxLength(200).optional(),
    logo: vine.string().optional(),
    media: vine
      .object({
        items: vine.array(
          vine.object({
            media_url: vine.string(),
            media_type: vine.enum(['image', 'video']),
            video_source: vine.enum(['youtube']).optional(),
          })
        ),
      })
      .optional(),
    start_period: vine.date().nullable().optional(),
    end_period: vine.date().nullable().optional(),
    is_show: vine.boolean().optional(),
    is_registration_open: vine.boolean().optional(),
    registration_end_date: vine.date().nullable().optional(),
  })
)

export const updateClubValidator = vine.compile(
  vine.object({
    name: vine.string().optional(),
    club_type: vine.enum(['UKM', 'AVISMAN']).optional(),
    description: vine.string().optional(),
    short_description: vine.string().maxLength(200).optional(),
    logo: vine.string().optional(),
    media: vine
      .object({
        items: vine.array(
          vine.object({
            media_url: vine.string(),
            media_type: vine.enum(['image', 'video']),
            video_source: vine.enum(['youtube']).optional(),
          })
        ),
      })
      .optional(),
    start_period: vine.date().nullable().optional(),
    end_period: vine.date().nullable().optional(),
    is_show: vine.boolean().optional(),
    is_registration_open: vine.boolean().optional(),
    registration_end_date: vine.date().nullable().optional(),
  })
)

export const logoValidator = vine.compile(
  vine.object({
    file: vine.file({
      size: '2mb',
      extnames: ['jpg', 'png', 'jpeg', 'webp'],
    }),
  })
)

export const imageMediaValidator = vine.compile(
  vine.object({
    file: vine.file({
      size: '5mb',
      extnames: ['jpg', 'png', 'jpeg', 'webp'],
    }),
    media_type: vine.literal('image'),
  })
)

export const youtubeMediaValidator = vine.compile(
  vine.object({
    media_url: vine.string().url(),
    media_type: vine.literal('video'),
    video_source: vine.literal('youtube'),
  })
)

export const deleteClubMediaValidator = vine.compile(
  vine.object({
    media_url: vine.string().trim().minLength(1),
  })
)
