import Activity from '#models/activity'
import CertificateTemplate from '#models/certificate_template'
import { buildCertificateData } from '#services/certificate_service'
import { getCertificateTemplateReadiness } from '#services/certificate_template_readiness_service'
import db from '@adonisjs/lucid/services/db'

export type RecipientState =
  | 'eligible_not_issued'
  | 'not_eligible'
  | 'issued_active'
  | 'issued_revoked'
export interface CertificateRecipient {
  registration_id: number
  name: string
  status: string
  state: RecipientState
  certificate_id: number | null
  certificate_code: string | null
}

// Profiles are not unique by user_id in the shared schema. Select one profile so
// recipient rows and aggregate counts cannot multiply when legacy duplicates exist.
const NAME_SQL = `COALESCE((SELECT NULLIF(p.name, '') FROM profiles p
  WHERE p.user_id = r.user_id ORDER BY p.id LIMIT 1), NULLIF(r.guest_data->>'name', ''), 'Peserta')`
const STATE_SQL = `CASE WHEN c.revoked_at IS NOT NULL THEN 'issued_revoked'
  WHEN c.id IS NOT NULL THEN 'issued_active'
  WHEN r.status = 'LULUS KEGIATAN' THEN 'eligible_not_issued' ELSE 'not_eligible' END`

function recipientQuery(activityId: number) {
  return db
    .from('activity_registrations as r')
    .leftJoin('issued_certificates as c', 'c.registration_id', 'r.id')
    .where('r.activity_id', activityId)
}

export async function getCertificateRecipients(
  activityId: number,
  options: {
    page: number
    perPage: number
    search?: string
    state?: RecipientState
    registrationIds?: number[]
  }
) {
  const activity = await Activity.findOrFail(activityId)
  const templateId =
    activity.certificateTemplateId ?? activity.additionalConfig?.certificate_template_id
  const query = recipientQuery(activityId)
  if (options.search) query.whereRaw(`${NAME_SQL} ILIKE ?`, [`%${options.search}%`])
  if (options.state) query.whereRaw(`${STATE_SQL} = ?`, [options.state])
  if (options.registrationIds) query.whereIn('r.id', options.registrationIds)
  const [rows, countRows, template] = await Promise.all([
    query
      .select('r.id as registration_id', 'r.status', 'c.id as certificate_id', 'c.certificate_code')
      .select(db.raw(`${NAME_SQL} as name`), db.raw(`${STATE_SQL} as state`))
      .orderBy('r.id', 'asc')
      .paginate(options.page, options.perPage),
    recipientQuery(activityId)
      .select(db.raw(`${STATE_SQL} as state`))
      .count('* as total')
      .groupByRaw(STATE_SQL),
    templateId ? CertificateTemplate.find(templateId) : null,
  ])
  const counts: Record<RecipientState, number> = {
    eligible_not_issued: 0,
    not_eligible: 0,
    issued_active: 0,
    issued_revoked: 0,
  }
  for (const row of countRows as Array<{ state: RecipientState; total: string }>) {
    counts[row.state] = Number(row.total)
  }
  return {
    activity: { id: activity.id, name: activity.name },
    template: template
      ? {
          id: template.id,
          name: template.name,
          version: template.version,
          status: template.lifecycleStatus,
          readiness: getCertificateTemplateReadiness(template),
        }
      : null,
    counts,
    meta: rows.getMeta(),
    data: rows.all() as CertificateRecipient[],
  }
}

export async function prepareCertificateIssuance(activityId: number, registrationIds?: number[]) {
  const activity = await Activity.findOrFail(activityId)
  const templateId =
    activity.certificateTemplateId ?? activity.additionalConfig?.certificate_template_id
  const template = templateId ? await CertificateTemplate.find(templateId) : null
  if (
    !template ||
    template.lifecycleStatus !== 'published' ||
    !getCertificateTemplateReadiness(template).ready
  ) {
    return { success: false as const, error: 'CERTIFICATE_TEMPLATE_NOT_READY' as const }
  }
  const query = recipientQuery(activityId)
  if (registrationIds) query.whereIn('r.id', registrationIds)
  const rows = (await query
    .select('r.id as registration_id')
    .select(db.raw(`${STATE_SQL} as state`))
    .orderBy('r.id', 'asc')) as Array<{ registration_id: number; state: RecipientState }>
  const eligibleIds = rows
    .filter((row) => row.state === 'eligible_not_issued')
    .map((row) => row.registration_id)
  const preview = eligibleIds.length ? await buildCertificateData(eligibleIds[0]) : null
  if (preview && !preview.success) return preview
  // Reject a changed assignment/version instead of reviewing two different designs.
  if (
    preview?.success &&
    (preview.data.template.id !== template.id || preview.data.template.version !== template.version)
  ) {
    return { success: false as const, error: 'CERTIFICATE_CONTEXT_CHANGED' as const }
  }
  return {
    success: true as const,
    data: {
      activity_id: activityId,
      template_id: template.id,
      template_version: template.version,
      registration_ids: eligibleIds,
      excluded: {
        already_issued: rows.filter((row) => row.state === 'issued_active').length,
        revoked: rows.filter((row) => row.state === 'issued_revoked').length,
        not_eligible: rows.filter((row) => row.state === 'not_eligible').length,
        missing: registrationIds ? new Set(registrationIds).size - rows.length : 0,
      },
      preview: preview?.success ? preview.data : null,
    },
  }
}

export async function getRecipientNames(ids: number[]): Promise<Map<number, string>> {
  if (!ids.length) return new Map()
  const rows = (await db
    .from('activity_registrations as r')
    .whereIn('r.id', ids)
    .select('r.id')
    .select(db.raw(`${NAME_SQL} as name`))) as Array<{ id: number; name: string }>
  return new Map(rows.map((row) => [row.id, row.name]))
}
