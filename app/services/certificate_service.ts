import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'
import Activity from '#models/activity'
import ActivityRegistration from '#models/activity_registration'
import CertificateTemplate from '#models/certificate_template'
import IssuedCertificate from '#models/issued_certificate'
import University from '#models/university'
import { generateCertificateCode } from '#services/certificate_code_service'
import { getCertificateTemplateReadiness } from '#services/certificate_template_readiness_service'

export const ELIGIBLE_CERTIFICATE_STATUS = 'LULUS KEGIATAN'

export type CertificateParticipantData = {
  registration_id: number
  user_id: number | null
  name: string
  email: string
  university: string
  gender: string
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
  version: number
  background_image: string | null
  template_data: CertificateTemplate['templateData']
}

export type IssuedCertificateData = {
  id: number
  certificate_code: string
  registration_id: number
  activity_id: number
  template_id: number
  template_version: number
  issued_at: string
  issued_by: number | null
  revoked_at: string | null
  revoked_reason: string | null
  revoked_by: number | null
}

export type CertificateResponseData = {
  activity: CertificateActivityData
  template: CertificateTemplateData
  participant: CertificateParticipantData
  certificate?: IssuedCertificateData
}

export type CertificateErrorType =
  | 'REGISTRATION_NOT_FOUND'
  | 'REGISTRATION_NOT_ELIGIBLE'
  | 'ACTIVITY_NOT_FOUND'
  | 'NO_CERTIFICATE_TEMPLATE'
  | 'CERTIFICATE_TEMPLATE_NOT_FOUND'
  | 'CERTIFICATE_TEMPLATE_NOT_PUBLISHED'
  | 'CERTIFICATE_TEMPLATE_NOT_READY'
  | 'INVALID_STATUS'
  | 'CERTIFICATE_NOT_FOUND'
  | 'CERTIFICATE_ALREADY_REVOKED'

export type CertificateResult =
  | { success: true; data: CertificateResponseData }
  | { success: false; error: CertificateErrorType; details?: string[] }

export type IssueCertificateResult =
  | { success: true; data: CertificateResponseData; issued: IssuedCertificate; created: boolean }
  | { success: false; error: CertificateErrorType; details?: string[] }

export type BulkCertificateResult = {
  created: CertificateResponseData[]
  already_issued: CertificateResponseData[]
  issued: CertificateResponseData[]
  skipped: Array<{ registration_id: number; reason: CertificateErrorType }>
  failed: Array<{ registration_id: number; reason: string }>
  total_requested: number
  total_created: number
  total_already_issued: number
  total_skipped: number
  total_failed: number
}

export type IssuedCertificateListItem = {
  id: number
  certificate_code: string
  registration_id: number
  activity_id: number
  participant_name: string
  participant_email: string
  activity_name: string
  template_name: string
  issued_at: string
  issued_by: number | null
  issued_by_name: string | null
  revoked_at: string | null
  revoked_reason: string | null
  revoked_by: number | null
  revoked_by_name: string | null
  state: 'issued_active' | 'issued_revoked'
}

type LoadedCertificateSource = {
  registration: ActivityRegistration
  activity: Activity
  template: CertificateTemplate
  participant: CertificateParticipantData
  activityData: CertificateActivityData
  templateData: CertificateTemplateData
}

function guestString(registration: ActivityRegistration, key: string): string {
  const value = registration.guestData?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

async function resolveGuestUniversity(
  registration: ActivityRegistration,
  client: QueryClientContract
): Promise<string> {
  const directUniversity = guestString(registration, 'university')
  if (directUniversity) {
    return directUniversity
  }

  const rawUniversityId = registration.guestData?.university_id
  const universityId =
    typeof rawUniversityId === 'number'
      ? rawUniversityId
      : typeof rawUniversityId === 'string' && /^\d+$/.test(rawUniversityId)
        ? Number(rawUniversityId)
        : null

  if (!universityId) {
    return ''
  }

  const university = await University.query({ client }).where('id', universityId).first()
  return university?.name ?? ''
}

async function buildParticipantData(
  registration: ActivityRegistration,
  activity: Activity,
  client: QueryClientContract
): Promise<CertificateParticipantData> {
  const isGuest = registration.userId === null
  const profile = registration.publicUser?.profile

  return {
    registration_id: registration.id,
    user_id: registration.userId,
    name: isGuest
      ? guestString(registration, 'name') || 'Unknown'
      : profile?.name || registration.publicUser?.email || 'Unknown',
    email: isGuest ? guestString(registration, 'email') : registration.publicUser?.email || '',
    university: isGuest
      ? await resolveGuestUniversity(registration, client)
      : profile?.university?.name || '',
    gender: isGuest ? guestString(registration, 'gender') : profile?.gender || '',
    activity_name: activity.name,
    activity_date: activity.activityStart
      ? activity.activityStart.setLocale('id').toFormat('dd MMMM yyyy')
      : '',
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
    version: template.version,
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
    template_version: issued.templateVersion,
    issued_at: issued.issuedAt.toISO() ?? '',
    issued_by: issued.issuedBy,
    revoked_at: issued.revokedAt?.toISO() ?? null,
    revoked_reason: issued.revokedReason,
    revoked_by: issued.revokedBy,
  }
}

export function buildIssuedResponseData(issued: IssuedCertificate): CertificateResponseData {
  return {
    activity: issued.activitySnapshot ?? {
      id: issued.activityId,
      name: issued.participantSnapshot.activity_name,
      activity_start: null,
    },
    template: issued.templateSnapshot,
    participant: {
      ...issued.participantSnapshot,
      gender: issued.participantSnapshot.gender ?? '',
    },
    certificate: buildIssuedCertificateData(issued),
  }
}

async function loadCertificateSource(
  registrationId: number,
  client: QueryClientContract,
  lockRows: boolean
): Promise<
  | { success: true; data: LoadedCertificateSource }
  | { success: false; error: CertificateErrorType; details?: string[] }
> {
  let registrationQuery = ActivityRegistration.query({ client })
    .where('id', registrationId)
    .preload('publicUser', (query) => {
      query.preload('profile', (profileQuery) => profileQuery.preload('university'))
    })

  if (lockRows) {
    registrationQuery = registrationQuery.forUpdate()
  }

  const registration = await registrationQuery.first()
  if (!registration) {
    return { success: false, error: 'REGISTRATION_NOT_FOUND' }
  }
  if (registration.status !== ELIGIBLE_CERTIFICATE_STATUS) {
    return { success: false, error: 'REGISTRATION_NOT_ELIGIBLE' }
  }

  let activityQuery = Activity.query({ client }).where('id', registration.activityId)
  if (lockRows) {
    activityQuery = activityQuery.forUpdate()
  }
  const activity = await activityQuery.first()
  if (!activity) {
    return { success: false, error: 'ACTIVITY_NOT_FOUND' }
  }

  const templateId =
    activity.certificateTemplateId ?? activity.additionalConfig?.certificate_template_id ?? null
  if (!templateId) {
    return { success: false, error: 'NO_CERTIFICATE_TEMPLATE' }
  }

  let templateQuery = CertificateTemplate.query({ client }).where('id', templateId)
  if (lockRows) {
    templateQuery = templateQuery.forUpdate()
  }
  const template = await templateQuery.first()
  if (!template) {
    return { success: false, error: 'CERTIFICATE_TEMPLATE_NOT_FOUND' }
  }
  if (template.lifecycleStatus !== 'published') {
    return { success: false, error: 'CERTIFICATE_TEMPLATE_NOT_PUBLISHED' }
  }

  const readiness = getCertificateTemplateReadiness(template)
  if (!readiness.ready) {
    return {
      success: false,
      error: 'CERTIFICATE_TEMPLATE_NOT_READY',
      details: readiness.errors,
    }
  }

  return {
    success: true,
    data: {
      registration,
      activity,
      template,
      participant: await buildParticipantData(registration, activity, client),
      activityData: buildActivityData(activity),
      templateData: buildTemplateData(template),
    },
  }
}

export async function buildCertificateData(registrationId: number): Promise<CertificateResult> {
  return db.transaction(async (trx) => {
    const source = await loadCertificateSource(registrationId, trx, false)
    if (!source.success) {
      return source
    }

    return {
      success: true,
      data: {
        activity: source.data.activityData,
        template: source.data.templateData,
        participant: source.data.participant,
      },
    }
  })
}

async function insertIssuedCertificate(
  source: LoadedCertificateSource,
  issuedBy: number | null,
  trx: TransactionClientContract
): Promise<{ issued: IssuedCertificate; created: boolean }> {
  const issuedAt = DateTime.now()
  const inserted = (await trx
    .knexClient('issued_certificates')
    .insert({
      certificate_code: generateCertificateCode(source.activity.id),
      registration_id: source.registration.id,
      activity_id: source.activity.id,
      user_id: source.registration.userId,
      template_id: source.template.id,
      template_snapshot: source.templateData,
      participant_snapshot: source.participant,
      activity_snapshot: source.activityData,
      snapshot_version: 1,
      template_version: source.template.version,
      issued_by: issuedBy,
      issued_at: issuedAt.toSQL(),
      revoked_at: null,
      revoked_reason: null,
      revoked_by: null,
      created_at: issuedAt.toSQL(),
      updated_at: issuedAt.toSQL(),
    })
    .onConflict('registration_id')
    .ignore()
    .returning('id')) as Array<{ id: number }>

  const issued = await IssuedCertificate.query({ client: trx })
    .where('registrationId', source.registration.id)
    .firstOrFail()

  return { issued, created: inserted.length > 0 }
}

export async function issueSingleCertificate(
  registrationId: number,
  issuedBy: number | null,
  requestId?: string
): Promise<IssueCertificateResult> {
  const result = await db.transaction(async (trx) => {
    const existing = await IssuedCertificate.query({ client: trx })
      .where('registrationId', registrationId)
      .first()

    if (existing) {
      return {
        success: true as const,
        data: buildIssuedResponseData(existing),
        issued: existing,
        created: false,
      }
    }

    const source = await loadCertificateSource(registrationId, trx, true)
    if (!source.success) {
      return source
    }

    const persisted = await insertIssuedCertificate(source.data, issuedBy, trx)
    return {
      success: true as const,
      data: buildIssuedResponseData(persisted.issued),
      issued: persisted.issued,
      created: persisted.created,
    }
  })

  if (result.success) {
    logger.info({
      event: result.created ? 'certificate_issued' : 'certificate_issue_reused',
      request_id: requestId,
      actor_admin_id: issuedBy,
      registration_id: registrationId,
      certificate_id: result.issued.id,
      certificate_code: result.issued.certificateCode,
    })
  }

  return result
}

export async function issueBulkCertificates(
  registrationIds: number[],
  issuedBy: number | null,
  requestId?: string
): Promise<BulkCertificateResult> {
  const uniqueRegistrationIds = [...new Set(registrationIds)]
  const created: CertificateResponseData[] = []
  const alreadyIssued: CertificateResponseData[] = []
  const skipped: BulkCertificateResult['skipped'] = []
  const failed: BulkCertificateResult['failed'] = []

  for (const registrationId of uniqueRegistrationIds) {
    try {
      const result = await issueSingleCertificate(registrationId, issuedBy, requestId)
      if (!result.success) {
        skipped.push({ registration_id: registrationId, reason: result.error })
      } else if (result.created) {
        created.push(result.data)
      } else {
        alreadyIssued.push(result.data)
      }
    } catch {
      failed.push({ registration_id: registrationId, reason: 'GENERAL_ERROR' })
    }
  }

  logger.info({
    event: 'certificate_bulk_issue_completed',
    request_id: requestId,
    actor_admin_id: issuedBy,
    total_requested: uniqueRegistrationIds.length,
    total_created: created.length,
    total_already_issued: alreadyIssued.length,
    total_skipped: skipped.length,
    total_failed: failed.length,
  })

  return {
    created,
    already_issued: alreadyIssued,
    issued: created,
    skipped,
    failed,
    total_requested: uniqueRegistrationIds.length,
    total_created: created.length,
    total_already_issued: alreadyIssued.length,
    total_skipped: skipped.length,
    total_failed: failed.length,
  }
}

export async function listIssuedCertificates(options: {
  activityId?: number
  page: number
  perPage: number
}): Promise<{ meta: Record<string, unknown>; data: IssuedCertificateListItem[] }> {
  const query = IssuedCertificate.query()
    .preload('issuer')
    .preload('revoker')
    .orderBy('issuedAt', 'desc')

  if (options.activityId) {
    query.where('activityId', options.activityId)
  }

  const certificates = await query.paginate(options.page, options.perPage)
  const serialized = certificates.serialize()

  return {
    meta: serialized.meta,
    data: certificates.all().map((issued) => ({
      id: issued.id,
      certificate_code: issued.certificateCode,
      registration_id: issued.registrationId,
      activity_id: issued.activityId,
      participant_name: issued.participantSnapshot.name,
      participant_email: issued.participantSnapshot.email,
      activity_name: issued.participantSnapshot.activity_name,
      template_name: issued.templateSnapshot.name,
      issued_at: issued.issuedAt.toISO() ?? '',
      issued_by: issued.issuedBy,
      issued_by_name: issued.issuer?.displayName ?? null,
      revoked_at: issued.revokedAt?.toISO() ?? null,
      revoked_reason: issued.revokedReason,
      revoked_by: issued.revokedBy,
      revoked_by_name: issued.revoker?.displayName ?? null,
      state: issued.revokedAt ? 'issued_revoked' : 'issued_active',
    })),
  }
}

export async function getIssuedCertificateById(id: number): Promise<CertificateResult> {
  const issued = await IssuedCertificate.find(id)
  return issued
    ? { success: true, data: buildIssuedResponseData(issued) }
    : { success: false, error: 'CERTIFICATE_NOT_FOUND' }
}

export async function getIssuedCertificateByCode(code: string): Promise<CertificateResult> {
  const normalizedCode = code.trim().toUpperCase()
  const issued = await IssuedCertificate.findBy('certificateCode', normalizedCode)
  return issued
    ? { success: true, data: buildIssuedResponseData(issued) }
    : { success: false, error: 'CERTIFICATE_NOT_FOUND' }
}

export async function revokeIssuedCertificate(
  id: number,
  reason: string,
  revokedBy: number,
  requestId?: string
): Promise<CertificateResult> {
  const result = await db.transaction(async (trx) => {
    const issued = await IssuedCertificate.query({ client: trx })
      .where('id', id)
      .forUpdate()
      .first()
    if (!issued) {
      return { success: false as const, error: 'CERTIFICATE_NOT_FOUND' as const }
    }
    if (issued.revokedAt) {
      return { success: false as const, error: 'CERTIFICATE_ALREADY_REVOKED' as const }
    }

    issued.useTransaction(trx)
    await issued.merge({ revokedAt: DateTime.now(), revokedReason: reason, revokedBy }).save()
    return { success: true as const, data: buildIssuedResponseData(issued) }
  })

  if (result.success) {
    logger.warn({
      event: 'certificate_revoked',
      request_id: requestId,
      actor_admin_id: revokedBy,
      certificate_id: id,
      reason,
    })
  }

  return result
}

export async function buildBulkCertificateData(
  activityId: number,
  status: string = ELIGIBLE_CERTIFICATE_STATUS
): Promise<
  | {
      success: true
      data: {
        activity: Activity
        template: CertificateTemplate
        participants: CertificateParticipantData[]
      }
    }
  | { success: false; error: CertificateErrorType; details?: string[] }
> {
  return db.transaction(async (trx) => {
    const activity = await Activity.query({ client: trx }).where('id', activityId).first()
    if (!activity) {
      return { success: false, error: 'ACTIVITY_NOT_FOUND' }
    }

    const templateId =
      activity.certificateTemplateId ?? activity.additionalConfig?.certificate_template_id ?? null
    if (!templateId) {
      return { success: false, error: 'NO_CERTIFICATE_TEMPLATE' }
    }

    const template = await CertificateTemplate.query({ client: trx })
      .where('id', templateId)
      .first()
    if (!template) {
      return { success: false, error: 'CERTIFICATE_TEMPLATE_NOT_FOUND' }
    }
    if (template.lifecycleStatus !== 'published') {
      return { success: false, error: 'CERTIFICATE_TEMPLATE_NOT_PUBLISHED' }
    }

    const readiness = getCertificateTemplateReadiness(template)
    if (!readiness.ready) {
      return {
        success: false,
        error: 'CERTIFICATE_TEMPLATE_NOT_READY',
        details: readiness.errors,
      }
    }

    const registrations = await ActivityRegistration.query({ client: trx })
      .where('activityId', activityId)
      .where('status', status)
      .preload('publicUser', (query) => {
        query.preload('profile', (profileQuery) => profileQuery.preload('university'))
      })

    if (registrations.length === 0) {
      return { success: false, error: 'INVALID_STATUS' }
    }

    const participants = await Promise.all(
      registrations.map((registration) => buildParticipantData(registration, activity, trx))
    )

    return { success: true, data: { activity, template, participants } }
  })
}
