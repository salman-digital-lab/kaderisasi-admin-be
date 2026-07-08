import Activity from '#models/activity'
import ActivityRegistration from '#models/activity_registration'
import CertificateTemplate from '#models/certificate_template'
import IssuedCertificate from '#models/issued_certificate'
import { DateTime } from 'luxon'

export type CertificateParticipantData = {
  registration_id: number
  user_id: number | null
  name: string
  email: string
  university: string
  activity_name: string
  activity_date: string
}

export type CertificateActivityData = {
  id: number
  name: string
  activity_start: string | null
}

export type CertificateTemplateData = {
  id: number
  name: string
  background_image: string | null
  template_data: {
    backgroundUrl: string | null
    elements: Array<{
      id: string
      type: 'static-text' | 'variable-text' | 'image' | 'qr-code' | 'signature'
      name?: string
      x: number
      y: number
      width: number
      height: number
      content?: string
      variable?: string
      fontSize?: number
      fontFamily?: string
      color?: string
      textAlign?: 'left' | 'center' | 'right'
      verticalAlign?: 'top' | 'middle' | 'bottom'
      fontWeight?: 'normal' | 'bold'
      fontStyle?: 'normal' | 'italic'
      textDecoration?: 'none' | 'underline'
      lineHeight?: number
      letterSpacing?: number
      imageUrl?: string
      opacity?: number
      rotation?: number
      borderRadius?: number
      objectFit?: 'contain' | 'cover' | 'fill'
      visible?: boolean
      locked?: boolean
    }>
    canvasWidth: number
    canvasHeight: number
  }
}

export type CertificateResponseData = {
  activity: CertificateActivityData
  template: CertificateTemplateData
  participant: CertificateParticipantData
  certificate?: IssuedCertificateData
}

export type IssuedCertificateData = {
  id: number
  certificate_code: string
  registration_id: number
  activity_id: number
  template_id: number
  issued_at: string
  revoked_at: string | null
  revoked_reason: string | null
}

export type CertificateErrorType =
  | 'REGISTRATION_NOT_FOUND'
  | 'ACTIVITY_NOT_FOUND'
  | 'NO_CERTIFICATE_TEMPLATE'
  | 'CERTIFICATE_TEMPLATE_NOT_FOUND'
  | 'INVALID_STATUS'
  | 'CERTIFICATE_NOT_FOUND'
  | 'CERTIFICATE_REVOKED'

export type CertificateResult =
  | { success: true; data: CertificateResponseData }
  | { success: false; error: CertificateErrorType }

export type IssueCertificateResult =
  | { success: true; data: CertificateResponseData; issued: IssuedCertificate; created: boolean }
  | { success: false; error: CertificateErrorType }

async function fetchRegistration(registrationId: number) {
  return ActivityRegistration.query()
    .where('id', registrationId)
    .where('status', 'LULUS KEGIATAN')
    .preload('publicUser', (query) => {
      query.preload('profile', (profileQuery) => {
        profileQuery.preload('university')
      })
    })
    .first()
}

async function fetchActivity(activityId: number) {
  return Activity.find(activityId)
}

async function fetchTemplate(templateId: number) {
  return CertificateTemplate.find(templateId)
}

function buildParticipantData(
  registration: ActivityRegistration,
  activity: Activity
): CertificateParticipantData {
  const profile = registration.publicUser?.profile

  return {
    registration_id: registration.id,
    user_id: registration.userId,
    name: profile?.name || registration.publicUser?.email || 'Unknown',
    email: registration.publicUser?.email || '',
    university: profile?.university?.name || '',
    activity_name: activity.name,
    activity_date: activity.activityStart ? activity.activityStart.toFormat('dd MMMM yyyy') : '',
  }
}

function buildActivityData(activity: Activity): CertificateActivityData {
  return {
    id: activity.id,
    name: activity.name,
    activity_start: activity.activityStart?.toISO() ?? null,
  }
}

function buildTemplateData(template: CertificateTemplate): CertificateTemplateData {
  return {
    id: template.id,
    name: template.name,
    background_image: template.backgroundImage,
    template_data: template.templateData,
  }
}

function buildIssuedCertificateData(issued: IssuedCertificate): IssuedCertificateData {
  return {
    id: issued.id,
    certificate_code: issued.certificateCode,
    registration_id: issued.registrationId,
    activity_id: issued.activityId,
    template_id: issued.templateId,
    issued_at: issued.issuedAt.toISO() ?? '',
    revoked_at: issued.revokedAt?.toISO() ?? null,
    revoked_reason: issued.revokedReason,
  }
}

function buildIssuedResponseData(issued: IssuedCertificate): CertificateResponseData {
  return {
    activity: {
      id: issued.activityId,
      name: issued.participantSnapshot.activity_name,
      activity_start: null,
    },
    template: issued.templateSnapshot,
    participant: issued.participantSnapshot,
    certificate: buildIssuedCertificateData(issued),
  }
}

async function generateCertificateCode(activityId: number): Promise<string> {
  const year = DateTime.now().toFormat('yyyy')

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase()
    const code = `CERT-${year}-${activityId}-${randomPart}`
    const existing = await IssuedCertificate.findBy('certificateCode', code)

    if (!existing) {
      return code
    }
  }

  return `CERT-${year}-${activityId}-${Date.now()}`
}

export async function buildCertificateData(registrationId: number): Promise<CertificateResult> {
  const registration = await fetchRegistration(registrationId)

  if (!registration) {
    return { success: false, error: 'REGISTRATION_NOT_FOUND' }
  }

  const activity = await fetchActivity(registration.activityId)

  if (!activity) {
    return { success: false, error: 'ACTIVITY_NOT_FOUND' }
  }

  const templateId = activity.additionalConfig?.certificate_template_id

  if (!templateId) {
    return { success: false, error: 'NO_CERTIFICATE_TEMPLATE' }
  }

  const template = await fetchTemplate(templateId)

  if (!template) {
    return { success: false, error: 'CERTIFICATE_TEMPLATE_NOT_FOUND' }
  }

  return {
    success: true,
    data: {
      activity: buildActivityData(activity),
      template: buildTemplateData(template),
      participant: buildParticipantData(registration, activity),
    },
  }
}

export async function issueSingleCertificate(
  registrationId: number,
  issuedBy: number | null
): Promise<IssueCertificateResult> {
  const existing = await IssuedCertificate.query().where('registrationId', registrationId).first()

  if (existing) {
    return {
      success: true,
      data: buildIssuedResponseData(existing),
      issued: existing,
      created: false,
    }
  }

  const result = await buildCertificateData(registrationId)

  if (!result.success) {
    return result
  }

  const issued = await IssuedCertificate.create({
    certificateCode: await generateCertificateCode(result.data.activity.id),
    registrationId: result.data.participant.registration_id,
    activityId: result.data.activity.id,
    userId: result.data.participant.user_id,
    templateId: result.data.template.id,
    templateSnapshot: result.data.template,
    participantSnapshot: result.data.participant,
    issuedBy,
    issuedAt: DateTime.now(),
  })

  return {
    success: true,
    data: {
      ...result.data,
      certificate: buildIssuedCertificateData(issued),
    },
    issued,
    created: true,
  }
}

export async function issueBulkCertificates(
  registrationIds: number[],
  issuedBy: number | null
): Promise<{
  issued: CertificateResponseData[]
  skipped: Array<{ registration_id: number; reason: CertificateErrorType }>
}> {
  const issued: CertificateResponseData[] = []
  const skipped: Array<{ registration_id: number; reason: CertificateErrorType }> = []

  for (const registrationId of registrationIds) {
    const result = await issueSingleCertificate(registrationId, issuedBy)

    if (result.success) {
      issued.push(result.data)
    } else {
      skipped.push({ registration_id: registrationId, reason: result.error })
    }
  }

  return { issued, skipped }
}

export async function listIssuedCertificates(activityId?: number): Promise<IssuedCertificate[]> {
  const query = IssuedCertificate.query().orderBy('issuedAt', 'desc')

  if (activityId) {
    query.where('activityId', activityId)
  }

  return query
}

export async function getIssuedCertificateById(id: number): Promise<CertificateResult> {
  const issued = await IssuedCertificate.find(id)

  if (!issued) {
    return { success: false, error: 'CERTIFICATE_NOT_FOUND' }
  }

  return { success: true, data: buildIssuedResponseData(issued) }
}

export async function getIssuedCertificateByCode(code: string): Promise<CertificateResult> {
  const issued = await IssuedCertificate.findBy('certificateCode', code)

  if (!issued) {
    return { success: false, error: 'CERTIFICATE_NOT_FOUND' }
  }

  return { success: true, data: buildIssuedResponseData(issued) }
}

export async function revokeIssuedCertificate(
  id: number,
  reason: string | null
): Promise<CertificateResult> {
  const issued = await IssuedCertificate.find(id)

  if (!issued) {
    return { success: false, error: 'CERTIFICATE_NOT_FOUND' }
  }

  await issued
    .merge({
      revokedAt: DateTime.now(),
      revokedReason: reason,
    })
    .save()

  return { success: true, data: buildIssuedResponseData(issued) }
}

export async function buildBulkCertificateData(
  activityId: number,
  status: string = 'LULUS KEGIATAN'
): Promise<
  | {
      success: true
      data: {
        activity: Activity
        template: CertificateTemplate
        participants: CertificateParticipantData[]
      }
    }
  | { success: false; error: CertificateErrorType }
> {
  const activity = await fetchActivity(activityId)

  if (!activity) {
    return { success: false, error: 'ACTIVITY_NOT_FOUND' }
  }

  const templateId = activity.additionalConfig?.certificate_template_id

  if (!templateId) {
    return { success: false, error: 'NO_CERTIFICATE_TEMPLATE' }
  }

  const template = await fetchTemplate(templateId)

  if (!template) {
    return { success: false, error: 'CERTIFICATE_TEMPLATE_NOT_FOUND' }
  }

  const registrations = await ActivityRegistration.query()
    .where('activity_id', activityId)
    .where('status', status)
    .preload('publicUser', (query) => {
      query.preload('profile')
    })

  if (registrations.length === 0) {
    return { success: false, error: 'INVALID_STATUS' }
  }

  const participants = registrations.map((reg) => buildParticipantData(reg, activity))

  return {
    success: true,
    data: {
      activity,
      template,
      participants,
    },
  }
}

export async function validateRegistrationOwnership(
  registrationId: number,
  userId: number
): Promise<boolean> {
  const registration = await ActivityRegistration.query()
    .where('id', registrationId)
    .where('userId', userId)
    .first()

  return registration !== null
}
