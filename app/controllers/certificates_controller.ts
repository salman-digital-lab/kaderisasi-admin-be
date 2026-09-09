import {
  buildBulkCertificateData,
  buildCertificateData,
  getIssuedCertificateByCode,
  getIssuedCertificateById,
  issueBulkCertificates,
  issueSingleCertificate,
  listIssuedCertificates,
  revokeIssuedCertificate,
  type CertificateErrorType,
} from '#services/certificate_service'
import {
  getCertificateRecipients,
  getRecipientNames,
  prepareCertificateIssuance,
} from '#services/certificate_workflow_service'
import type { HttpContext } from '@adonisjs/core/http'
import vine, { errors } from '@vinejs/vine'

const generateCertificatesValidator = vine.compile(
  vine.object({
    activity_id: vine.number().withoutDecimals().positive(),
    status: vine.string().trim().maxLength(50).optional(),
  })
)

const registrationCertificateValidator = vine.compile(
  vine.object({
    registration_id: vine.number().withoutDecimals().positive(),
  })
)

const issueBulkCertificateValidator = vine.compile(
  vine.object({
    expected: vine
      .object({
        activity_id: vine.number().positive().withoutDecimals(),
        template_id: vine.number().positive().withoutDecimals(),
        template_version: vine.number().positive().withoutDecimals(),
      })
      .optional(),
    response_mode: vine.enum(['full', 'compact']).optional(),
    registration_ids: vine
      .array(vine.number().withoutDecimals().positive())
      .minLength(1)
      .maxLength(100),
  })
)

const prepareValidator = vine.compile(
  vine.object({
    activity_id: vine.number().positive().withoutDecimals(),
    registration_ids: vine
      .array(vine.number().positive().withoutDecimals())
      .minLength(1)
      .maxLength(100_000)
      .optional(),
  })
)
const recipientsValidator = vine.compile(
  vine.object({
    page: vine.number().positive().withoutDecimals().optional(),
    per_page: vine.number().range([1, 100]).withoutDecimals().optional(),
    search: vine.string().trim().maxLength(255).optional(),
    state: vine
      .enum(['eligible_not_issued', 'not_eligible', 'issued_active', 'issued_revoked'])
      .optional(),
    registration_ids: vine
      .array(vine.number().positive().withoutDecimals())
      .maxLength(200)
      .optional(),
  })
)

const revokeCertificateValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(3).maxLength(1000),
  })
)

function parsePositiveId(value: string): number | null {
  if (!/^[1-9][0-9]*$/.test(value)) {
    return null
  }

  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

function validationError(response: HttpContext['response'], error: { messages: unknown }) {
  return response.status(422).json({
    message: 'VALIDATION_ERROR',
    errors: error.messages,
  })
}

function domainError(
  response: HttpContext['response'],
  error: CertificateErrorType,
  details?: string[]
) {
  if (
    error === 'REGISTRATION_NOT_FOUND' ||
    error === 'ACTIVITY_NOT_FOUND' ||
    error === 'CERTIFICATE_TEMPLATE_NOT_FOUND' ||
    error === 'CERTIFICATE_NOT_FOUND'
  ) {
    return response.notFound({ message: error })
  }

  if (error === 'CERTIFICATE_CONTEXT_CHANGED') return response.conflict({ message: error })

  if (error === 'REGISTRATION_NOT_ELIGIBLE' || error === 'CERTIFICATE_ALREADY_REVOKED') {
    return response.conflict({ message: error })
  }

  if (
    error === 'NO_CERTIFICATE_TEMPLATE' ||
    error === 'CERTIFICATE_TEMPLATE_NOT_PUBLISHED' ||
    error === 'CERTIFICATE_TEMPLATE_NOT_READY'
  ) {
    return response.status(422).json({ message: error, errors: details })
  }

  return response.badRequest({ message: error })
}

export default class CertificatesController {
  async recipients({ params, request, response }: HttpContext) {
    const activityId = parsePositiveId(params.activityId)
    if (!activityId) return response.badRequest({ message: 'INVALID_ACTIVITY_ID' })
    try {
      const options = await recipientsValidator.validate(request.qs())
      const data = await getCertificateRecipients(activityId, {
        page: options.page ?? 1,
        perPage: options.per_page ?? 50,
        search: options.search,
        state: options.state,
        registrationIds: options.registration_ids,
      })
      return response.ok({ message: 'GET_DATA_SUCCESS', data })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) return validationError(response, error)
      if (error && typeof error === 'object' && 'code' in error && error.code === 'E_ROW_NOT_FOUND')
        return response.notFound({ message: 'ACTIVITY_NOT_FOUND' })
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }

  async prepare({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(prepareValidator)
      const result = await prepareCertificateIssuance(payload.activity_id, payload.registration_ids)
      return result.success
        ? response.ok({ message: 'CERTIFICATE_REVIEW_READY', data: result.data })
        : domainError(response, result.error)
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) return validationError(response, error)
      if (error && typeof error === 'object' && 'code' in error && error.code === 'E_ROW_NOT_FOUND')
        return response.notFound({ message: 'ACTIVITY_NOT_FOUND' })
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }

  async index({ request, response }: HttpContext) {
    try {
      const rawActivityId = request.qs().activity_id
      const activityId = rawActivityId === undefined ? undefined : Number(rawActivityId)
      if (activityId !== undefined && (!Number.isSafeInteger(activityId) || activityId <= 0)) {
        return response.badRequest({ message: 'INVALID_ACTIVITY_ID' })
      }

      const page = Math.max(Number(request.qs().page) || 1, 1)
      const perPage = Math.min(Math.max(Number(request.qs().per_page) || 20, 1), 100)
      const filters = await recipientsValidator.validate(request.qs())
      const certificates = await listIssuedCertificates({
        activityId,
        page,
        perPage,
        registrationIds: filters.registration_ids,
      })

      return response.ok({ message: 'GET_DATA_SUCCESS', data: certificates })
    } catch {
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }

  async show({ params, response }: HttpContext) {
    try {
      const id = parsePositiveId(params.id)
      if (!id) {
        return response.badRequest({ message: 'INVALID_CERTIFICATE_ID' })
      }

      const result = await getIssuedCertificateById(id)
      return result.success
        ? response.ok({ message: 'GET_DATA_SUCCESS', data: result.data })
        : domainError(response, result.error, result.details)
    } catch {
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }

  async showByCode({ params, response }: HttpContext) {
    try {
      const result = await getIssuedCertificateByCode(params.code)
      return result.success
        ? response.ok({ message: 'GET_DATA_SUCCESS', data: result.data })
        : domainError(response, result.error, result.details)
    } catch {
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }

  async verify({ params, response }: HttpContext) {
    try {
      const result = await getIssuedCertificateByCode(params.code)
      if (!result.success) {
        return response.notFound({ message: result.error, data: { valid: false } })
      }

      return response.ok({
        message: 'CERTIFICATE_VERIFIED',
        data: {
          valid: !result.data.certificate?.revoked_at,
          certificate: result.data.certificate,
          participant: result.data.participant,
          activity: result.data.activity,
        },
      })
    } catch {
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }

  async issueSingle({ request, response, auth, requestId }: HttpContext) {
    try {
      const payload = await request.validateUsing(registrationCertificateValidator)
      const result = await issueSingleCertificate(
        payload.registration_id,
        auth.user?.id ?? null,
        requestId
      )

      if (!result.success) {
        return domainError(response, result.error, result.details)
      }

      return response.status(result.created ? 201 : 200).json({
        message: result.created ? 'CERTIFICATE_ISSUED' : 'CERTIFICATE_ALREADY_ISSUED',
        data: result.data,
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationError(response, error)
      }
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }

  async issueBulk({ request, response, auth, requestId }: HttpContext) {
    try {
      const payload = await request.validateUsing(issueBulkCertificateValidator)
      const result = await issueBulkCertificates(
        payload.registration_ids,
        auth.user?.id ?? null,
        requestId,
        payload.expected
      )

      if (payload.response_mode === 'compact') {
        const names = await getRecipientNames(payload.registration_ids)
        const results = [
          ...result.created.map((item) => ({
            registration_id: item.participant.registration_id,
            name: item.participant.name,
            state: 'created',
            certificate_id: item.certificate?.id,
            certificate_code: item.certificate?.certificate_code,
          })),
          ...result.already_issued.map((item) => ({
            registration_id: item.participant.registration_id,
            name: item.participant.name,
            state: item.certificate?.revoked_at ? 'skipped' : 'already_issued',
            reason: item.certificate?.revoked_at ? 'CERTIFICATE_ALREADY_REVOKED' : undefined,
            certificate_id: item.certificate?.id,
            certificate_code: item.certificate?.certificate_code,
          })),
          ...result.skipped.map((item) => ({
            ...item,
            name: names.get(item.registration_id) ?? 'Peserta',
            state: 'skipped',
          })),
          ...result.failed.map((item) => ({
            ...item,
            name: names.get(item.registration_id) ?? 'Peserta',
            state: 'failed',
          })),
        ]
        return response.ok({
          message: 'CERTIFICATES_ISSUED',
          data: { results, paused: result.paused, remaining_ids: result.remaining_ids },
        })
      }
      return response.ok({ message: 'CERTIFICATES_ISSUED', data: result })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationError(response, error)
      }
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }

  async revoke({ params, request, response, auth, requestId }: HttpContext) {
    try {
      const id = parsePositiveId(params.id)
      if (!id) {
        return response.badRequest({ message: 'INVALID_CERTIFICATE_ID' })
      }

      const payload = await request.validateUsing(revokeCertificateValidator)
      const actorId = auth.user?.id
      if (!actorId) {
        return response.unauthorized({ message: 'UNAUTHORIZED' })
      }

      const result = await revokeIssuedCertificate(id, payload.reason, actorId, requestId)
      return result.success
        ? response.ok({ message: 'CERTIFICATE_REVOKED', data: result.data })
        : domainError(response, result.error, result.details)
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationError(response, error)
      }
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }

  async generate({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(generateCertificatesValidator)
      const result = await buildBulkCertificateData(
        payload.activity_id,
        payload.status || 'LULUS KEGIATAN'
      )

      if (!result.success) {
        return domainError(response, result.error, result.details)
      }

      return response.ok({
        message: 'CERTIFICATE_DATA_GENERATED',
        data: { ...result.data, total: result.data.participants.length },
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationError(response, error)
      }
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }

  async generateSingle({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(registrationCertificateValidator)
      const result = await buildCertificateData(payload.registration_id)

      return result.success
        ? response.ok({ message: 'CERTIFICATE_DATA_GENERATED', data: result.data })
        : domainError(response, result.error, result.details)
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationError(response, error)
      }
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }
}
