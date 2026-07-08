import { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import {
  buildCertificateData,
  buildBulkCertificateData,
  getIssuedCertificateByCode,
  getIssuedCertificateById,
  issueBulkCertificates,
  issueSingleCertificate,
  listIssuedCertificates,
  revokeIssuedCertificate,
} from '#services/certificate_service'

const generateCertificatesValidator = vine.compile(
  vine.object({
    activity_id: vine.number().positive(),
    status: vine.string().optional(),
  })
)

const generateSingleCertificateValidator = vine.compile(
  vine.object({
    registration_id: vine.number().positive(),
  })
)

const issueBulkCertificateValidator = vine.compile(
  vine.object({
    registration_ids: vine.array(vine.number().positive()).minLength(1),
  })
)

const revokeCertificateValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().nullable().optional(),
  })
)

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'UNKNOWN_ERROR'
}

export default class CertificatesController {
  async index({ request, response }: HttpContext) {
    try {
      const activityId = request.qs().activity_id ? Number(request.qs().activity_id) : undefined

      if (activityId !== undefined && (Number.isNaN(activityId) || activityId <= 0)) {
        return response.badRequest({ message: 'INVALID_ACTIVITY_ID' })
      }

      const certificates = await listIssuedCertificates(activityId)

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: certificates,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: getErrorMessage(error),
      })
    }
  }

  async show({ params, response }: HttpContext) {
    try {
      const id = Number.parseInt(params.id, 10)

      if (Number.isNaN(id) || id <= 0) {
        return response.badRequest({ message: 'INVALID_CERTIFICATE_ID' })
      }

      const result = await getIssuedCertificateById(id)

      if (!result.success) {
        return response.notFound({ message: result.error })
      }

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: result.data,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: getErrorMessage(error),
      })
    }
  }

  async showByCode({ params, response }: HttpContext) {
    try {
      const result = await getIssuedCertificateByCode(params.code)

      if (!result.success) {
        return response.notFound({ message: result.error })
      }

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: result.data,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: getErrorMessage(error),
      })
    }
  }

  async verify({ params, response }: HttpContext) {
    try {
      const result = await getIssuedCertificateByCode(params.code)

      if (!result.success) {
        return response.notFound({
          message: result.error,
          data: { valid: false },
        })
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
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: getErrorMessage(error),
      })
    }
  }

  async issueSingle({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(generateSingleCertificateValidator)
      const result = await issueSingleCertificate(payload.registration_id, auth.user?.id ?? null)

      if (!result.success) {
        const httpStatus =
          result.error === 'REGISTRATION_NOT_FOUND' ||
          result.error === 'ACTIVITY_NOT_FOUND' ||
          result.error === 'CERTIFICATE_TEMPLATE_NOT_FOUND'
            ? 404
            : 400
        if (httpStatus === 404) {
          return response.notFound({ message: result.error })
        }
        return response.badRequest({ message: result.error })
      }

      return response.status(result.created ? 201 : 200).json({
        message: result.created ? 'CERTIFICATE_ISSUED' : 'CERTIFICATE_ALREADY_ISSUED',
        data: result.data,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'ValidationException') {
        return response.badRequest({
          message: 'VALIDATION_ERROR',
          errors: 'messages' in error ? error.messages : undefined,
        })
      }
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: getErrorMessage(error),
      })
    }
  }

  async issueBulk({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(issueBulkCertificateValidator)
      const result = await issueBulkCertificates(payload.registration_ids, auth.user?.id ?? null)

      return response.ok({
        message: 'CERTIFICATES_ISSUED',
        data: {
          issued: result.issued,
          skipped: result.skipped,
          total_issued: result.issued.length,
          total_skipped: result.skipped.length,
        },
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'ValidationException') {
        return response.badRequest({
          message: 'VALIDATION_ERROR',
          errors: 'messages' in error ? error.messages : undefined,
        })
      }
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: getErrorMessage(error),
      })
    }
  }

  async revoke({ params, request, response }: HttpContext) {
    try {
      const id = Number.parseInt(params.id, 10)

      if (Number.isNaN(id) || id <= 0) {
        return response.badRequest({ message: 'INVALID_CERTIFICATE_ID' })
      }

      const payload = await request.validateUsing(revokeCertificateValidator)
      const result = await revokeIssuedCertificate(id, payload.reason ?? null)

      if (!result.success) {
        return response.notFound({ message: result.error })
      }

      return response.ok({
        message: 'CERTIFICATE_REVOKED',
        data: result.data,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'ValidationException') {
        return response.badRequest({
          message: 'VALIDATION_ERROR',
          errors: 'messages' in error ? error.messages : undefined,
        })
      }
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: getErrorMessage(error),
      })
    }
  }

  async generate({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(generateCertificatesValidator)
      const status = payload.status || 'LULUS KEGIATAN'

      const result = await buildBulkCertificateData(payload.activity_id, status)

      if (!result.success) {
        const httpStatus =
          result.error === 'ACTIVITY_NOT_FOUND' || result.error === 'CERTIFICATE_TEMPLATE_NOT_FOUND'
            ? 404
            : 400
        if (httpStatus === 404) {
          return response.notFound({ message: result.error })
        }
        return response.badRequest({ message: result.error })
      }

      return response.ok({
        message: 'CERTIFICATE_DATA_GENERATED',
        data: {
          activity: result.data.activity,
          template: result.data.template,
          participants: result.data.participants,
          total: result.data.participants.length,
        },
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'ValidationException') {
        return response.badRequest({
          message: 'VALIDATION_ERROR',
          errors: 'messages' in error ? error.messages : undefined,
        })
      }
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: getErrorMessage(error),
      })
    }
  }

  async generateSingle({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(generateSingleCertificateValidator)

      const result = await buildCertificateData(payload.registration_id)

      if (!result.success) {
        const httpStatus =
          result.error === 'REGISTRATION_NOT_FOUND' ||
          result.error === 'ACTIVITY_NOT_FOUND' ||
          result.error === 'CERTIFICATE_TEMPLATE_NOT_FOUND'
            ? 404
            : 400
        if (httpStatus === 404) {
          return response.notFound({ message: result.error })
        }
        return response.badRequest({ message: result.error })
      }

      return response.ok({
        message: 'CERTIFICATE_DATA_GENERATED',
        data: result.data,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'ValidationException') {
        return response.badRequest({
          message: 'VALIDATION_ERROR',
          errors: 'messages' in error ? error.messages : undefined,
        })
      }
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: getErrorMessage(error),
      })
    }
  }
}
