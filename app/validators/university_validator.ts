import vine from '@vinejs/vine'

export const UniversityValidator = vine.compile(
  vine.object({
    name: vine.string(),
  })
)
