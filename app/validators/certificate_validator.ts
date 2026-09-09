import vine from '@vinejs/vine'

export const lookupCertificatesValidator = vine.compile(
  vine.object({
    activity_id: vine.number().withoutDecimals().range([1, Number.MAX_SAFE_INTEGER]).optional(),
    registration_ids: vine
      .array(vine.number().withoutDecimals().range([1, Number.MAX_SAFE_INTEGER]))
      .minLength(1)
      .maxLength(100),
  })
)
