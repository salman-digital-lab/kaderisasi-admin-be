import vine from '@vinejs/vine'

export const certificateTemplateValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    description: vine.string().trim().nullable().optional(),
    templateData: vine.object({
      backgroundUrl: vine.string().nullable().optional(),
      elements: vine.array(
        vine.object({
          id: vine.string(),
          type: vine.enum(['static-text', 'variable-text', 'qr-code', 'signature']),
          x: vine.number(),
          y: vine.number(),
          width: vine.number(),
          height: vine.number(),
          content: vine.string().optional(),
          variable: vine.string().optional(),
          fontSize: vine.number().optional(),
          fontFamily: vine.string().optional(),
          color: vine.string().optional(),
          textAlign: vine.enum(['left', 'center', 'right']).optional(),
          imageUrl: vine.string().optional(),
        })
      ).optional(),
      canvasWidth: vine.number().optional(),
      canvasHeight: vine.number().optional(),
    }).optional(),
    isActive: vine.boolean().optional(),
  })
)

export const updateCertificateTemplateValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    description: vine.string().trim().nullable().optional(),
    templateData: vine.object({
      backgroundUrl: vine.string().nullable().optional(),
      elements: vine.array(
        vine.object({
          id: vine.string(),
          type: vine.enum(['static-text', 'variable-text', 'qr-code', 'signature']),
          x: vine.number(),
          y: vine.number(),
          width: vine.number(),
          height: vine.number(),
          content: vine.string().optional(),
          variable: vine.string().optional(),
          fontSize: vine.number().optional(),
          fontFamily: vine.string().optional(),
          color: vine.string().optional(),
          textAlign: vine.enum(['left', 'center', 'right']).optional(),
          imageUrl: vine.string().optional(),
        })
      ).optional(),
      canvasWidth: vine.number().optional(),
      canvasHeight: vine.number().optional(),
    }).optional(),
    isActive: vine.boolean().optional(),
  })
)

export const backgroundImageValidator = vine.compile(
  vine.object({
    file: vine.file({
      size: '5mb',
      extnames: ['jpg', 'png', 'jpeg', 'PNG', 'JPG', 'JPEG', 'webp', 'WEBP'],
    }),
  })
)
