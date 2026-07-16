import vine from '@vinejs/vine'

const certificateElementSchema = vine.object({
  id: vine.string(),
  type: vine.enum(['static-text', 'variable-text', 'image', 'qr-code', 'signature']),
  name: vine.string().maxLength(255).optional(),
  x: vine.number().range([0, 5000]),
  y: vine.number().range([0, 5000]),
  width: vine.number().range([1, 5000]),
  height: vine.number().range([1, 5000]),
  content: vine.string().maxLength(10_000).optional(),
  variable: vine.string().maxLength(100).optional(),
  fontSize: vine.number().range([1, 500]).optional(),
  fontFamily: vine.string().maxLength(255).optional(),
  color: vine.string().maxLength(64).optional(),
  textAlign: vine.enum(['left', 'center', 'right']).optional(),
  verticalAlign: vine.enum(['top', 'middle', 'bottom']).optional(),
  fontWeight: vine.enum(['normal', 'bold']).optional(),
  fontStyle: vine.enum(['normal', 'italic']).optional(),
  textDecoration: vine.enum(['none', 'underline']).optional(),
  lineHeight: vine.number().range([0.1, 10]).optional(),
  letterSpacing: vine.number().range([-100, 500]).optional(),
  imageUrl: vine.string().maxLength(4096).optional(),
  opacity: vine.number().range([0, 100]).optional(),
  rotation: vine.number().range([-360, 360]).optional(),
  borderRadius: vine.number().range([0, 2500]).optional(),
  objectFit: vine.enum(['contain', 'cover', 'fill']).optional(),
  visible: vine.boolean().optional(),
  locked: vine.boolean().optional(),
})

const templateDataSchema = vine.object({
  backgroundUrl: vine.string().maxLength(4096).nullable().optional(),
  elements: vine.array(certificateElementSchema).maxLength(200).optional(),
  canvasWidth: vine.number().range([100, 5000]).optional(),
  canvasHeight: vine.number().range([100, 5000]).optional(),
})

export const certificateTemplateValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    description: vine.string().trim().nullable().optional(),
    templateData: templateDataSchema.optional(),
    status: vine.enum(['draft', 'published', 'archived']).optional(),
    isActive: vine.boolean().optional(),
  })
)

export const updateCertificateTemplateValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    description: vine.string().trim().nullable().optional(),
    templateData: templateDataSchema.optional(),
    backgroundImage: vine.string().trim().maxLength(1024).nullable().optional(),
    status: vine.enum(['draft', 'published', 'archived']).optional(),
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

export const certificateAssetValidator = backgroundImageValidator
