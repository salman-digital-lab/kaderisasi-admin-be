import vine from '@vinejs/vine'

export const clubValidator = vine.compile(
  vine.object({
    name: vine.string(),
    description: vine.string().optional(),
    logo: vine.string().optional(),
    media: vine
      .object({
        items: vine
          .array(
            vine.object({
              media_url: vine.string(),
              media_type: vine.enum(['image', 'video']),
              video_source: vine.enum(['youtube']).optional(),
            })
          )
      })
      .optional(),
    start_period: vine.date().optional(),
    end_period: vine.date().optional(),
    is_show: vine.boolean().optional(),
  })
)

export const updateClubValidator = vine.compile(
  vine.object({
    name: vine.string().optional(),
    description: vine.string().optional(),
    logo: vine.string().optional(),
    media: vine
      .object({
        items: vine
          .array(
            vine.object({
              media_url: vine.string(),
              media_type: vine.enum(['image', 'video']),
              video_source: vine.enum(['youtube']).optional(),
            })
          )
      })
      .optional(),
    start_period: vine.date().optional(),
    end_period: vine.date().optional(),
    is_show: vine.boolean().optional(),
  })
)

export const logoValidator = vine.compile(
  vine.object({
    file: vine.file({
      size: '2mb',
      extnames: ['jpg', 'png', 'jpeg', 'PNG', 'JPG', 'JPEG', 'webp', 'WEBP'],
    }),
  })
)

export const imageMediaValidator = vine.compile(
  vine.object({
    file: vine.file({
      size: '5mb',
      extnames: ['jpg', 'png', 'jpeg', 'PNG', 'JPG', 'JPEG', 'webp', 'WEBP'],
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
