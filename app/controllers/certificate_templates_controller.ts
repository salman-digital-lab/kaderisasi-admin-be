import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import { errors } from '@vinejs/vine'
import Activity from '#models/activity'
import CertificateTemplate, {
  type CertificateTemplateLifecycle,
  type TemplateData,
} from '#models/certificate_template'
import IssuedCertificate from '#models/issued_certificate'
import {
  certificateAssetValidator,
  certificateTemplateValidator,
  mutateCertificateTemplateLifecycleValidator,
  updateCertificateTemplateValidator,
  backgroundImageValidator,
} from '#validators/certificate_template_validator'
import {
  getCertificateTemplateReadiness,
  lifecycleData,
} from '#services/certificate_template_readiness_service'
import {
  matchesCertificateTemplateVersion,
  nextCertificateTemplateVersion,
} from '#services/certificate_template_version_service'

const DEFAULT_TEMPLATE_DATA: TemplateData = {
  backgroundUrl: null,
  elements: [],
  canvasWidth: 800,
  canvasHeight: 566,
}

function parsePositiveId(value: string): number | null {
  if (!/^[1-9][0-9]*$/.test(value)) {
    return null
  }

  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

function serializeTemplate(
  template: CertificateTemplate,
  counts: { activityUsageCount?: number; issuedCertificateCount?: number } = {}
): Record<string, unknown> {
  return {
    ...template.serialize(),
    ...lifecycleData(template),
    readiness: getCertificateTemplateReadiness(template),
    activity_usage_count: counts.activityUsageCount ?? 0,
    issued_certificate_count: counts.issuedCertificateCount ?? 0,
  }
}

async function getTemplateUsageCounts(templateIds: number[]): Promise<{
  activityCounts: Map<number, number>
  certificateCounts: Map<number, number>
}> {
  if (templateIds.length === 0) {
    return { activityCounts: new Map(), certificateCounts: new Map() }
  }

  const [activityRows, certificateRows] = await Promise.all([
    Activity.query()
      .whereIn('certificateTemplateId', templateIds)
      .select('certificateTemplateId')
      .count('* as total')
      .groupBy('certificateTemplateId'),
    IssuedCertificate.query()
      .whereIn('templateId', templateIds)
      .select('templateId')
      .count('* as total')
      .groupBy('templateId'),
  ])

  return {
    activityCounts: new Map(
      activityRows
        .filter((row): row is Activity & { certificateTemplateId: number } =>
          Number.isInteger(row.certificateTemplateId)
        )
        .map((row) => [row.certificateTemplateId, Number(row.$extras.total)])
    ),
    certificateCounts: new Map(
      certificateRows.map((row) => [row.templateId, Number(row.$extras.total)])
    ),
  }
}

function validationError(response: HttpContext['response'], error: { messages: unknown }) {
  return response.status(422).json({
    message: 'VALIDATION_ERROR',
    errors: error.messages,
  })
}

function versionConflict(response: HttpContext['response'], template: CertificateTemplate) {
  return response.conflict({
    message: 'CERTIFICATE_TEMPLATE_VERSION_CONFLICT',
    currentVersion: template.version,
    updatedAt: template.updatedAt.toISO(),
  })
}

export default class CertificateTemplatesController {
  async index({ request, response }: HttpContext) {
    try {
      const page = Math.max(Number(request.qs().page) || 1, 1)
      const perPage = Math.min(Math.max(Number(request.qs().per_page) || 10, 1), 100)
      const search = typeof request.qs().search === 'string' ? request.qs().search.trim() : ''
      const requestedStatus = request.qs().status
      const legacyIsActive = request.qs().is_active
      const query = CertificateTemplate.query()

      if (search) {
        query.where('name', 'ILIKE', `%${search}%`)
      }

      if (requestedStatus && ['draft', 'published', 'archived'].includes(requestedStatus)) {
        query.where('lifecycleStatus', requestedStatus)
      } else if (legacyIsActive !== undefined) {
        query.where('lifecycleStatus', legacyIsActive === 'true' ? 'published' : 'archived')
      }

      const templates = await query.orderBy('createdAt', 'desc').paginate(page, perPage)
      const serialized = templates.serialize()
      const models = templates.all()
      const counts = await getTemplateUsageCounts(models.map((template) => template.id))

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: {
          ...serialized,
          data: models.map((template) =>
            serializeTemplate(template, {
              activityUsageCount: counts.activityCounts.get(template.id),
              issuedCertificateCount: counts.certificateCounts.get(template.id),
            })
          ),
        },
      })
    } catch {
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }

  async show({ params, response }: HttpContext) {
    try {
      const id = parsePositiveId(params.id)

      if (!id) {
        return response.badRequest({ message: 'INVALID_CERTIFICATE_TEMPLATE_ID' })
      }

      const template = await CertificateTemplate.find(id)

      if (!template) {
        return response.notFound({ message: 'CERTIFICATE_TEMPLATE_NOT_FOUND' })
      }

      const counts = await getTemplateUsageCounts([template.id])
      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: serializeTemplate(template, {
          activityUsageCount: counts.activityCounts.get(template.id),
          issuedCertificateCount: counts.certificateCounts.get(template.id),
        }),
      })
    } catch {
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }

  async store({ request, response, auth, requestId }: HttpContext) {
    try {
      const payload = await request.validateUsing(certificateTemplateValidator)
      if (payload.status === 'published') {
        return response.status(422).json({ message: 'USE_TEMPLATE_PUBLISH_ENDPOINT' })
      }

      const lifecycleStatus: CertificateTemplateLifecycle =
        payload.status === 'archived' ? 'archived' : 'draft'
      const template = await CertificateTemplate.create({
        name: payload.name,
        description: payload.description ?? null,
        templateData: (payload.templateData ?? DEFAULT_TEMPLATE_DATA) as TemplateData,
        backgroundImage: null,
        lifecycleStatus,
        isActive: false,
        version: 1,
        backgroundAssetVersion: 0,
        publishedAt: null,
        archivedAt: lifecycleStatus === 'archived' ? DateTime.now() : null,
      })

      logger.info({
        event: 'certificate_template_created',
        request_id: requestId,
        actor_admin_id: auth.user?.id,
        template_id: template.id,
      })

      return response.created({
        message: 'CERTIFICATE_TEMPLATE_CREATED_SUCCESS',
        data: serializeTemplate(template),
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationError(response, error)
      }
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }

  async update({ params, request, response, auth, requestId }: HttpContext) {
    try {
      const id = parsePositiveId(params.id)

      if (!id) {
        return response.badRequest({ message: 'INVALID_CERTIFICATE_TEMPLATE_ID' })
      }

      const payload = await request.validateUsing(updateCertificateTemplateValidator)
      const result = await db.transaction(async (trx) => {
        const template = await CertificateTemplate.query({ client: trx })
          .where('id', id)
          .forUpdate()
          .first()

        if (!template) return { kind: 'not-found' as const }
        if (!matchesCertificateTemplateVersion(template.version, payload.expectedVersion)) {
          return { kind: 'conflict' as const, template }
        }

        let nextTemplateData = payload.templateData as TemplateData | undefined
        const backgroundChanged =
          payload.backgroundImage !== undefined &&
          payload.backgroundImage !== template.backgroundImage
        if (payload.backgroundImage) {
          const expectedPrefix = `certificate/templates/${template.id}/`
          if (
            !payload.backgroundImage.startsWith(expectedPrefix) ||
            !(await drive.use().exists(payload.backgroundImage))
          ) {
            return { kind: 'invalid-asset' as const }
          }
          nextTemplateData = { ...(nextTemplateData ?? template.templateData), backgroundUrl: null }
        }

        template.merge({
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(nextTemplateData !== undefined ? { templateData: nextTemplateData } : {}),
          ...(backgroundChanged
            ? {
                backgroundImage: payload.backgroundImage,
                backgroundAssetVersion: template.backgroundAssetVersion + 1,
              }
            : {}),
        })

        const requestedStatus: CertificateTemplateLifecycle | undefined =
          payload.status ??
          (payload.isActive === true
            ? 'published'
            : payload.isActive === false && template.lifecycleStatus === 'published'
              ? 'archived'
              : undefined)

        if (requestedStatus === 'published') {
          const readiness = getCertificateTemplateReadiness(template)
          if (!readiness.ready) return { kind: 'not-ready' as const, readiness }
          template.merge({
            lifecycleStatus: 'published',
            isActive: true,
            publishedAt: DateTime.now(),
            archivedAt: null,
          })
        } else if (requestedStatus === 'archived') {
          template.merge({
            lifecycleStatus: 'archived',
            isActive: false,
            archivedAt: DateTime.now(),
          })
        } else if (requestedStatus === 'draft') {
          template.merge({
            lifecycleStatus: 'draft',
            isActive: false,
            publishedAt: null,
            archivedAt: null,
          })
        }

        if (template.lifecycleStatus === 'published') {
          const readiness = getCertificateTemplateReadiness(template)
          if (!readiness.ready) return { kind: 'not-ready' as const, readiness }
        }

        template.version = nextCertificateTemplateVersion(template.version)
        await template.save()
        return { kind: 'updated' as const, template }
      })

      if (result.kind === 'not-found') {
        return response.notFound({ message: 'CERTIFICATE_TEMPLATE_NOT_FOUND' })
      }
      if (result.kind === 'conflict') return versionConflict(response, result.template)
      if (result.kind === 'invalid-asset') {
        return response.status(422).json({ message: 'INVALID_CERTIFICATE_ASSET_KEY' })
      }
      if (result.kind === 'not-ready') {
        return response.status(422).json({
          message: 'CERTIFICATE_TEMPLATE_NOT_READY',
          errors: result.readiness.errors,
        })
      }
      const template = result.template

      logger.info({
        event: 'certificate_template_updated',
        request_id: requestId,
        actor_admin_id: auth.user?.id,
        template_id: template.id,
        template_version: template.version,
      })

      return response.ok({
        message: 'CERTIFICATE_TEMPLATE_UPDATED_SUCCESS',
        data: serializeTemplate(template),
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationError(response, error)
      }
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }

  async publish({ params, request, response, auth, requestId }: HttpContext) {
    try {
      const id = parsePositiveId(params.id)
      if (!id) {
        return response.notFound({ message: 'CERTIFICATE_TEMPLATE_NOT_FOUND' })
      }
      const payload = await request.validateUsing(mutateCertificateTemplateLifecycleValidator)
      const result = await db.transaction(async (trx) => {
        const template = await CertificateTemplate.query({ client: trx })
          .where('id', id)
          .forUpdate()
          .first()
        if (!template) return { kind: 'not-found' as const }
        if (!matchesCertificateTemplateVersion(template.version, payload.expectedVersion)) {
          return { kind: 'conflict' as const, template }
        }
        const readiness = getCertificateTemplateReadiness(template)
        if (!readiness.ready) return { kind: 'not-ready' as const, readiness }
        template.merge({
          lifecycleStatus: 'published',
          isActive: true,
          publishedAt: DateTime.now(),
          archivedAt: null,
          version: nextCertificateTemplateVersion(template.version),
        })
        await template.save()
        return { kind: 'updated' as const, template }
      })
      if (result.kind === 'not-found') {
        return response.notFound({ message: 'CERTIFICATE_TEMPLATE_NOT_FOUND' })
      }
      if (result.kind === 'conflict') return versionConflict(response, result.template)
      if (result.kind === 'not-ready') {
        return response.status(422).json({
          message: 'CERTIFICATE_TEMPLATE_NOT_READY',
          errors: result.readiness.errors,
        })
      }
      const template = result.template

      logger.info({
        event: 'certificate_template_published',
        request_id: requestId,
        actor_admin_id: auth.user?.id,
        template_id: template.id,
        template_version: template.version,
      })

      return response.ok({
        message: 'CERTIFICATE_TEMPLATE_PUBLISHED',
        data: serializeTemplate(template),
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationError(response, error)
      }
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }

  async archive({ params, request, response, auth, requestId }: HttpContext) {
    try {
      const id = parsePositiveId(params.id)
      if (!id) {
        return response.notFound({ message: 'CERTIFICATE_TEMPLATE_NOT_FOUND' })
      }
      const payload = await request.validateUsing(mutateCertificateTemplateLifecycleValidator)
      const result = await db.transaction(async (trx) => {
        const template = await CertificateTemplate.query({ client: trx })
          .where('id', id)
          .forUpdate()
          .first()
        if (!template) return { kind: 'not-found' as const }
        if (!matchesCertificateTemplateVersion(template.version, payload.expectedVersion)) {
          return { kind: 'conflict' as const, template }
        }
        template.merge({
          lifecycleStatus: 'archived',
          isActive: false,
          archivedAt: DateTime.now(),
          version: nextCertificateTemplateVersion(template.version),
        })
        await template.save()
        return { kind: 'updated' as const, template }
      })
      if (result.kind === 'not-found') {
        return response.notFound({ message: 'CERTIFICATE_TEMPLATE_NOT_FOUND' })
      }
      if (result.kind === 'conflict') return versionConflict(response, result.template)
      const template = result.template

      logger.info({
        event: 'certificate_template_archived',
        request_id: requestId,
        actor_admin_id: auth.user?.id,
        template_id: template.id,
      })

      return response.ok({
        message: 'CERTIFICATE_TEMPLATE_ARCHIVED',
        data: serializeTemplate(template),
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationError(response, error)
      }
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }

  async destroy({ params, response }: HttpContext) {
    try {
      const id = parsePositiveId(params.id)
      const template = id ? await CertificateTemplate.find(id) : null

      if (!template) {
        return response.notFound({ message: 'CERTIFICATE_TEMPLATE_NOT_FOUND' })
      }

      const [activityReference, certificateReference] = await Promise.all([
        Activity.query().where('certificateTemplateId', template.id).first(),
        IssuedCertificate.query().where('templateId', template.id).first(),
      ])

      if (activityReference || certificateReference) {
        return response.conflict({ message: 'CERTIFICATE_TEMPLATE_IN_USE' })
      }

      await template.delete()
      return response.ok({ message: 'CERTIFICATE_TEMPLATE_DELETED_SUCCESS' })
    } catch {
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }

  async uploadBackground({ request, params, response, auth, requestId }: HttpContext) {
    let uploadedKey: string | null = null

    try {
      const payload = await request.validateUsing(backgroundImageValidator)
      const templateId = parsePositiveId(params.id)
      const template = templateId ? await CertificateTemplate.find(templateId) : null

      if (!template) {
        return response.notFound({ message: 'CERTIFICATE_TEMPLATE_NOT_FOUND' })
      }

      const file = payload.file
      const assetVersion = template.backgroundAssetVersion + 1
      const extension = file.extname?.toLowerCase() ?? 'img'
      uploadedKey = `certificate/templates/${template.id}/background/v${assetVersion}-${randomUUID()}.${extension}`
      await file.moveToDisk(uploadedKey)

      try {
        await template
          .merge({
            backgroundImage: uploadedKey,
            backgroundAssetVersion: assetVersion,
            version: template.version + 1,
          })
          .save()
      } catch (error) {
        await drive
          .use()
          .delete(uploadedKey)
          .catch(() => undefined)
        throw error
      }

      logger.info({
        event: 'certificate_template_background_uploaded',
        request_id: requestId,
        actor_admin_id: auth.user?.id,
        template_id: template.id,
        asset_version: assetVersion,
      })

      return response.ok({
        message: 'UPLOAD_BACKGROUND_SUCCESS',
        data: {
          backgroundImage: uploadedKey,
          asset_key: uploadedKey,
          url: uploadedKey,
          assetVersion,
          templateVersion: template.version,
        },
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationError(response, error)
      }
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }

  async uploadAsset({ request, params, response, auth, requestId }: HttpContext) {
    try {
      const payload = await request.validateUsing(certificateAssetValidator)
      const templateId = parsePositiveId(params.id)
      const template = templateId ? await CertificateTemplate.find(templateId) : null

      if (!template) {
        return response.notFound({ message: 'CERTIFICATE_TEMPLATE_NOT_FOUND' })
      }

      const extension = payload.file.extname?.toLowerCase() ?? 'img'
      const assetKey = `certificate/templates/${template.id}/assets/v${template.version + 1}-${randomUUID()}.${extension}`
      await payload.file.moveToDisk(assetKey)

      logger.info({
        event: 'certificate_template_asset_uploaded',
        request_id: requestId,
        actor_admin_id: auth.user?.id,
        template_id: template.id,
      })

      return response.created({
        message: 'UPLOAD_CERTIFICATE_ASSET_SUCCESS',
        data: { asset_key: assetKey, url: assetKey, assetKey },
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationError(response, error)
      }
      return response.internalServerError({ message: 'GENERAL_ERROR' })
    }
  }
}
