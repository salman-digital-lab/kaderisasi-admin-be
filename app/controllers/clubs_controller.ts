import { HttpContext } from '@adonisjs/core/http'
import { randomUUID } from 'node:crypto'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import Club, { CLUB_TYPES, type ClubType, type MediaStructure } from '#models/club'
import CustomForm from '#models/custom_form'
import {
  clubValidator,
  updateClubValidator,
  logoValidator,
  imageMediaValidator,
  youtubeMediaValidator,
  deleteClubMediaValidator,
} from '#validators/club_validator'
import { updateClubRegistrationInfoValidator } from '#validators/club_registration_validator'
import { getYoutubeVideoId, hasDuplicateMediaUrls, hasMediaUrl } from '#services/club_media_service'
import { InvalidImageError, storeOptimizedImage } from '#services/image_upload_service'

type ClubUpdateData = Partial<{
  name: string
  clubType: ClubType
  description: string
  shortDescription: string
  media: MediaStructure
  startPeriod: DateTime | null
  endPeriod: DateTime | null
  isShow: boolean
  isRegistrationOpen: boolean
  registrationEndDate: DateTime | null
}>

const MAX_CLUB_MEDIA_ITEMS = 20

export default class ClubsController {
  async index({ request, response }: HttpContext) {
    try {
      const page = request.qs().page ?? 1
      const perPage = request.qs().per_page ?? 10
      const search = request.qs().search
      const requestedClubType = request.qs().club_type
      const clubType = CLUB_TYPES.find((type) => type === requestedClubType)
      const visibility = request.qs().visibility
      const registration = request.qs().registration

      const query = Club.query()
        .where('name', 'ILIKE', search ? '%' + search + '%' : '%%')
        .select(
          'id',
          'name',
          'club_type',
          'description',
          'short_description',
          'logo',
          'created_at',
          'updated_at',
          'start_period',
          'end_period',
          'is_show',
          'is_registration_open',
          'registration_end_date'
        )

      if (clubType) {
        query.where('club_type', clubType)
      }

      if (visibility === 'published' || visibility === 'draft') {
        query.where('is_show', visibility === 'published')
      }

      if (registration === 'open' || registration === 'closed') {
        query.where('is_registration_open', registration === 'open')
      }

      const clubs = await query
        .orderBy('is_show', 'desc')
        .orderBy('created_at', 'desc')
        .paginate(page, perPage)

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: clubs,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async show({ params, response }: HttpContext) {
    try {
      const id: number = params.id
      const clubData = await Club.find(id)

      if (!clubData) {
        return response.notFound({
          message: 'CLUB_NOT_FOUND',
        })
      }

      // Get attached custom form if any
      const attachedForm = await CustomForm.query()
        .where('featureType', 'club_registration')
        .where('featureId', id)
        .orderBy('updatedAt', 'desc')
        .orderBy('id', 'desc')
        .first()

      const clubWithForm = {
        ...clubData.toJSON(),
        attachedCustomForm: attachedForm,
      }

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: clubWithForm,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async store({ request, response }: HttpContext) {
    const payload = await clubValidator.validate(request.all())
    try {
      if (payload.media && hasDuplicateMediaUrls(payload.media.items)) {
        return response.conflict({ message: 'MEDIA_ALREADY_EXISTS' })
      }

      // Convert snake_case to camelCase and handle date conversion
      const createData = {
        name: payload.name,
        clubType: payload.club_type ?? 'UNIT',
        description: payload.description,
        shortDescription: payload.short_description,
        media: payload.media || { items: [] },
        startPeriod: payload.start_period ? DateTime.fromJSDate(payload.start_period) : null,
        endPeriod: payload.end_period ? DateTime.fromJSDate(payload.end_period) : null,
        // New clubs are drafts until an admin explicitly reviews and publishes them.
        isShow: false,
        isRegistrationOpen: false,
        registrationEndDate: payload.registration_end_date
          ? DateTime.fromJSDate(payload.registration_end_date)
          : null,
      }

      const clubData = await Club.create(createData)

      return response.ok({
        message: 'CREATE_DATA_SUCCESS',
        data: clubData,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.stack,
      })
    }
  }

  async update({ params, request, response }: HttpContext) {
    const payload = await updateClubValidator.validate(request.all())
    try {
      const id = Number(params.id)

      if (payload.media && hasDuplicateMediaUrls(payload.media.items)) {
        return response.conflict({ message: 'MEDIA_ALREADY_EXISTS' })
      }

      const result = await db.transaction(async (trx) => {
        const clubData = await Club.query({ client: trx }).where('id', id).forUpdate().first()

        if (!clubData) {
          return { error: 'CLUB_NOT_FOUND' } as const
        }

        if (payload.is_registration_open === true) {
          const activeCustomForm = await CustomForm.query({ client: trx })
            .where('featureType', 'club_registration')
            .where('featureId', id)
            .where('isActive', true)
            .first()

          if (!activeCustomForm) {
            return { error: 'ACTIVE_CUSTOM_FORM_REQUIRED' } as const
          }

          const registrationEndDate =
            payload.registration_end_date !== undefined
              ? payload.registration_end_date
                ? DateTime.fromJSDate(payload.registration_end_date)
                : null
              : clubData.registrationEndDate

          if (
            registrationEndDate &&
            registrationEndDate.startOf('day').toMillis() <
              DateTime.local().startOf('day').toMillis()
          ) {
            return { error: 'REGISTRATION_END_DATE_PASSED' } as const
          }
        }

        // Convert snake_case to camelCase and handle date conversion
        const updateData: ClubUpdateData = {}

        if (payload.name !== undefined) updateData.name = payload.name
        if (payload.club_type !== undefined) updateData.clubType = payload.club_type
        if (payload.description !== undefined) updateData.description = payload.description
        if (payload.short_description !== undefined)
          updateData.shortDescription = payload.short_description
        if (payload.media !== undefined) updateData.media = payload.media
        if (payload.start_period !== undefined) {
          updateData.startPeriod = payload.start_period
            ? DateTime.fromJSDate(payload.start_period)
            : null
        }
        if (payload.end_period !== undefined) {
          updateData.endPeriod = payload.end_period ? DateTime.fromJSDate(payload.end_period) : null
        }
        if (payload.is_show !== undefined) updateData.isShow = payload.is_show
        if (payload.is_registration_open !== undefined)
          updateData.isRegistrationOpen = payload.is_registration_open
        if (payload.registration_end_date !== undefined) {
          updateData.registrationEndDate = payload.registration_end_date
            ? DateTime.fromJSDate(payload.registration_end_date)
            : null
        }

        clubData.useTransaction(trx)
        return { data: await clubData.merge(updateData).save() } as const
      })

      if ('error' in result) {
        if (result.error === 'CLUB_NOT_FOUND') {
          return response.notFound({ message: result.error })
        }

        return response.badRequest({ message: result.error })
      }

      return response.ok({
        message: 'UPDATE_DATA_SUCCESS',
        data: result.data,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async uploadLogo({ request, params, response }: HttpContext) {
    const payload = await request.validateUsing(logoValidator)
    const clubId = params.id
    let uploadedKey: string | null = null

    try {
      const club = await Club.find(clubId)
      if (!club) {
        return response.notFound({
          message: 'CLUB_NOT_FOUND',
        })
      }

      uploadedKey = await storeOptimizedImage(
        payload.file,
        `club/club_logo_${clubId}_${randomUUID()}`,
        'logo'
      )
      const storedLogoKey = uploadedKey

      const result = await db.transaction(async (trx) => {
        const lockedClub = await Club.query({ client: trx }).where('id', clubId).forUpdate().first()

        if (!lockedClub) return { error: 'CLUB_NOT_FOUND' } as const

        const previousLogo = lockedClub.logo
        lockedClub.useTransaction(trx)
        await lockedClub.merge({ logo: storedLogoKey }).save()
        return { logo: storedLogoKey, previousLogo } as const
      })

      if ('error' in result) {
        await drive
          .use()
          .delete(uploadedKey)
          .catch(() => undefined)
        uploadedKey = null
        return response.notFound({ message: result.error })
      }

      if (result.previousLogo && result.previousLogo !== result.logo) {
        await drive
          .use()
          .delete(result.previousLogo)
          .catch(() => undefined)
      }

      return response.ok({
        message: 'UPLOAD_LOGO_SUCCESS',
        data: { logo: result.logo },
      })
    } catch (error) {
      if (uploadedKey) {
        await drive
          .use()
          .delete(uploadedKey)
          .catch(() => undefined)
      }
      if (error instanceof InvalidImageError) {
        return response.unprocessableEntity({ message: error.message })
      }
      return response.internalServerError({
        message: 'GENERAL_ERROR',
      })
    }
  }

  async uploadImageMedia({ request, params, response }: HttpContext) {
    const payload = await request.validateUsing(imageMediaValidator)
    const clubId = params.id
    let mediaUrl: string | null = null

    try {
      const club = await Club.find(clubId)
      if (!club) {
        return response.notFound({
          message: 'CLUB_NOT_FOUND',
        })
      }

      if ((club.media?.items?.length ?? 0) >= MAX_CLUB_MEDIA_ITEMS) {
        return response.conflict({ message: 'CLUB_MEDIA_LIMIT_REACHED' })
      }

      mediaUrl = await storeOptimizedImage(
        payload.file,
        `club/club_media_${clubId}_${randomUUID()}`,
        'gallery'
      )
      const storedMediaUrl = mediaUrl

      try {
        const result = await db.transaction(async (trx) => {
          const lockedClub = await Club.query({ client: trx })
            .where('id', clubId)
            .forUpdate()
            .first()

          if (!lockedClub) return { error: 'CLUB_NOT_FOUND' } as const

          const currentItems = Array.isArray(lockedClub.media?.items)
            ? [...lockedClub.media.items]
            : []

          if (currentItems.length >= MAX_CLUB_MEDIA_ITEMS) {
            return { error: 'CLUB_MEDIA_LIMIT_REACHED' } as const
          }

          if (hasMediaUrl(currentItems, storedMediaUrl)) {
            return { error: 'MEDIA_ALREADY_EXISTS' } as const
          }

          currentItems.push({ media_url: storedMediaUrl, media_type: 'image' })
          const mediaStructure = { items: currentItems }

          lockedClub.useTransaction(trx)
          await lockedClub.merge({ media: mediaStructure }).save()
          return { media: mediaStructure } as const
        })

        if ('error' in result) {
          await drive
            .use()
            .delete(mediaUrl)
            .catch(() => undefined)
          mediaUrl = null

          if (result.error === 'CLUB_NOT_FOUND') {
            return response.notFound({ message: result.error })
          }

          return response.conflict({ message: result.error })
        }

        return response.ok({
          message: 'UPLOAD_MEDIA_SUCCESS',
          data: { media: result.media },
        })
      } catch (error) {
        if (mediaUrl) {
          await drive
            .use()
            .delete(mediaUrl)
            .catch(() => undefined)
          mediaUrl = null
        }
        throw error
      }
    } catch (error) {
      if (mediaUrl) {
        await drive
          .use()
          .delete(mediaUrl)
          .catch(() => undefined)
      }
      if (error instanceof InvalidImageError) {
        return response.unprocessableEntity({ message: error.message })
      }
      return response.internalServerError({
        message: 'GENERAL_ERROR',
      })
    }
  }

  async addYoutubeMedia({ request, params, response }: HttpContext) {
    const payload = await request.validateUsing(youtubeMediaValidator)
    const clubId = params.id
    try {
      const club = await Club.find(clubId)
      if (!club) {
        return response.notFound({
          message: 'CLUB_NOT_FOUND',
        })
      }

      const videoId = getYoutubeVideoId(payload.media_url)

      if (!videoId) {
        return response.badRequest({
          message: 'INVALID_YOUTUBE_URL',
        })
      }

      const embedUrl = `https://www.youtube.com/embed/${videoId}`

      const result = await db.transaction(async (trx) => {
        const lockedClub = await Club.query({ client: trx }).where('id', clubId).forUpdate().first()

        if (!lockedClub) return { error: 'CLUB_NOT_FOUND' } as const

        const currentItems = Array.isArray(lockedClub.media?.items)
          ? [...lockedClub.media.items]
          : []

        if (currentItems.length >= MAX_CLUB_MEDIA_ITEMS) {
          return { error: 'CLUB_MEDIA_LIMIT_REACHED' } as const
        }

        if (hasMediaUrl(currentItems, embedUrl)) {
          return { error: 'MEDIA_ALREADY_EXISTS' } as const
        }

        currentItems.push({
          media_url: embedUrl,
          media_type: 'video',
          video_source: 'youtube',
        })

        const mediaStructure = { items: currentItems }
        lockedClub.useTransaction(trx)
        await lockedClub.merge({ media: mediaStructure }).save()
        return { media: mediaStructure } as const
      })

      if ('error' in result) {
        if (result.error === 'CLUB_NOT_FOUND') {
          return response.notFound({ message: result.error })
        }

        return response.conflict({ message: result.error })
      }

      return response.ok({
        message: 'ADD_YOUTUBE_MEDIA_SUCCESS',
        data: { media: result.media },
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async deleteMedia({ request, params, response }: HttpContext) {
    const clubId = params.id
    try {
      const payload = await request.validateUsing(deleteClubMediaValidator)
      const result = await db.transaction(async (trx) => {
        const club = await Club.query({ client: trx }).where('id', clubId).forUpdate().first()

        if (!club) return { error: 'CLUB_NOT_FOUND' } as const

        const currentItems = Array.isArray(club.media?.items) ? [...club.media.items] : []
        const mediaIndex = currentItems.findIndex((item) => item.media_url === payload.media_url)

        if (mediaIndex === -1) return { error: 'MEDIA_NOT_FOUND' } as const

        const [removedMedia] = currentItems.splice(mediaIndex, 1)
        const mediaStructure = { items: currentItems }

        club.useTransaction(trx)
        await club.merge({ media: mediaStructure }).save()
        return { media: mediaStructure, removedMedia } as const
      })

      if ('error' in result) {
        return response.notFound({ message: result.error })
      }

      // Storage cleanup is best effort after the database no longer references the image.
      if (result.removedMedia.media_type === 'image') {
        try {
          await drive.use().delete(result.removedMedia.media_url)
        } catch {
          // The file may already be absent; the Club media state is still correct.
        }
      }

      return response.ok({
        message: 'DELETE_MEDIA_SUCCESS',
        data: { media: result.media },
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async updateRegistrationInfo({ params, request, response }: HttpContext) {
    try {
      const clubId = params.id
      const payload = await updateClubRegistrationInfoValidator.validate(request.all())

      const club = await Club.findOrFail(clubId)

      const registrationInfo = {
        registration_info: payload.registration_info || '',
      }

      await club.merge({ registrationInfo }).save()

      return response.ok({
        message: 'REGISTRATION_INFO_UPDATED',
        data: { registration_info: registrationInfo },
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }
}
