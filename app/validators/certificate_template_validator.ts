import vine from '@vinejs/vine'

const certificateElementSchema = vine.object({
  id: vine.string(),
  type: vine.enum(['static-text', 'variable-text', 'image', 'qr-code', 'signature']),
  name: vine.string().optional(),
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
  verticalAlign: vine.enum(['top', 'middle', 'bottom']).optional(),
  fontWeight: vine.enum(['normal', 'bold']).optional(),
  fontStyle: vine.enum(['normal', 'italic']).optional(),
  textDecoration: vine.enum(['none', 'underline']).optional(),
  lineHeight: vine.number().optional(),
  letterSpacing: vine.number().optional(),
  imageUrl: vine.string().optional(),
  opacity: vine.number().optional(),
  rotation: vine.number().optional(),
  borderRadius: vine.number().optional(),
  objectFit: vine.enum(['contain', 'cover', 'fill']).optional(),
  visible: vine.boolean().optional(),
  locked: vine.boolean().optional(),
})

const templateDataSchema = vine.object({
  backgroundUrl: vine.string().nullable().optional(),
  elements: vine.array(certificateElementSchema).optional(),
  canvasWidth: vine.number().optional(),
  canvasHeight: vine.number().optional(),
})

export const certificateTemplateValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    description: vine.string().trim().nullable().optional(),
    templateData: templateDataSchema.optional(),
    isActive: vine.boolean().optional(),
  })
)

export const updateCertificateTemplateValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    description: vine.string().trim().nullable().optional(),
    templateData: templateDataSchema.optional(),
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
