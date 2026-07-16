import type { CertificateTemplateLifecycle, TemplateData } from '#models/certificate_template'

export const ALLOWED_CERTIFICATE_VARIABLES = new Set([
  'name',
  'activity_name',
  'activity_date',
  'date',
  'certificate_code',
  'certificate_id',
  'university',
  'gender',
])

export type CertificateTemplateReadiness = {
  ready: boolean
  errors: string[]
}

export type CertificateTemplateReadinessInput = {
  id: number
  name: string
  backgroundImage: string | null
  templateData: TemplateData | null | undefined
}

export type CertificateTemplateLifecycleData = {
  status: CertificateTemplateLifecycle
  is_active: boolean
  version: number
  published_at: string | null
  archived_at: string | null
}

function normalizeVariable(variable: string | undefined): string {
  return variable?.replace(/\{\{|\}\}/g, '').trim() ?? ''
}

function isManagedAssetUrl(templateId: number, value: string): boolean {
  if (value.startsWith('data:')) {
    return false
  }

  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    return value.includes(`certificate/templates/${templateId}/`)
  }

  try {
    const pathname = new URL(value).pathname
    return pathname.includes(`/certificate/templates/${templateId}/`)
  } catch {
    return false
  }
}

export function getCertificateTemplateReadiness(
  template: CertificateTemplateReadinessInput
): CertificateTemplateReadiness {
  const errors = new Set<string>()
  const data = template.templateData

  if (!template.name.trim()) {
    errors.add('TEMPLATE_NAME_REQUIRED')
  }

  if (!data) {
    errors.add('TEMPLATE_DATA_REQUIRED')
    return { ready: false, errors: [...errors] }
  }

  if (
    !Number.isFinite(data.canvasWidth) ||
    !Number.isFinite(data.canvasHeight) ||
    data.canvasWidth < 100 ||
    data.canvasHeight < 100 ||
    data.canvasWidth > 5000 ||
    data.canvasHeight > 5000
  ) {
    errors.add('INVALID_CANVAS_SIZE')
  }

  if (data.backgroundUrl?.startsWith('data:')) {
    errors.add('BACKGROUND_MUST_USE_MANAGED_ASSET')
  }

  if (!Array.isArray(data.elements) || data.elements.length === 0) {
    errors.add('ELEMENTS_REQUIRED')
    return { ready: false, errors: [...errors] }
  }

  if (data.elements.length > 200) {
    errors.add('TOO_MANY_ELEMENTS')
  }

  const ids = new Set<string>()
  let hasParticipantName = false

  for (const element of data.elements) {
    if (!element.id || ids.has(element.id)) {
      errors.add('ELEMENT_IDS_MUST_BE_UNIQUE')
    }
    ids.add(element.id)

    if (
      !Number.isFinite(element.x) ||
      !Number.isFinite(element.y) ||
      !Number.isFinite(element.width) ||
      !Number.isFinite(element.height) ||
      element.x < 0 ||
      element.y < 0 ||
      element.width <= 0 ||
      element.height <= 0 ||
      element.x + element.width > data.canvasWidth ||
      element.y + element.height > data.canvasHeight
    ) {
      errors.add('ELEMENT_OUTSIDE_CANVAS')
    }

    if (element.type === 'variable-text') {
      const variable = normalizeVariable(element.variable)
      if (!ALLOWED_CERTIFICATE_VARIABLES.has(variable)) {
        errors.add('UNSUPPORTED_VARIABLE')
      }
      if (variable === 'name' && element.visible !== false) {
        hasParticipantName = true
      }
    }

    if ((element.type === 'image' || element.type === 'signature') && !element.imageUrl) {
      errors.add('ELEMENT_ASSET_REQUIRED')
    }

    if (
      (element.type === 'image' || element.type === 'signature') &&
      element.imageUrl &&
      !isManagedAssetUrl(template.id, element.imageUrl)
    ) {
      errors.add('ELEMENT_MUST_USE_MANAGED_ASSET')
    }
  }

  if (!hasParticipantName) {
    errors.add('PARTICIPANT_NAME_VARIABLE_REQUIRED')
  }

  return { ready: errors.size === 0, errors: [...errors] }
}

export function lifecycleData(input: {
  lifecycleStatus: CertificateTemplateLifecycle
  version: number
  publishedAt?: { toISO(): string | null } | null
  archivedAt?: { toISO(): string | null } | null
}): CertificateTemplateLifecycleData {
  return {
    status: input.lifecycleStatus,
    is_active: input.lifecycleStatus === 'published',
    version: input.version,
    published_at: input.publishedAt?.toISO() ?? null,
    archived_at: input.archivedAt?.toISO() ?? null,
  }
}
