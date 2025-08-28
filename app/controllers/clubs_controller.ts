import { HttpContext } from '@adonisjs/core/http'
import drive from '@adonisjs/drive/services/main'
import { DateTime } from 'luxon'

import Club, { type MediaItem } from '#models/club'
import {
  clubValidator,
  updateClubValidator,
  logoValidator,
  imageMediaValidator,
  youtubeMediaValidator,
} from '#validators/club_validator'
import { updateClubRegistrationInfoValidator } from '#validators/club_registration_validator'

export default class ClubsController {
  async index({ request, response }: HttpContext) {
    try {
      const page = request.qs().page ?? 1
      const perPage = request.qs().per_page ?? 10
      const search = request.qs().search

      const clubs = await Club.query()
        .where('name', 'ILIKE', search ? '%' + search + '%' : '%%')
        .select(
          'id',
          'name',
          'description',
          'short_description',
          'logo',
          'created_at',
          'updated_at',
          'start_period',
          'end_period',
          'is_show'
        )
        .orderBy('createdAt', 'desc')
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

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: clubData,
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
      // Convert snake_case to camelCase and handle date conversion
      const createData = {
        name: payload.name,
        description: payload.description,
        shortDescription: payload.short_description,
        media: payload.media || { items: [] },
        startPeriod: payload.start_period ? DateTime.fromJSDate(payload.start_period) : null,
        endPeriod: payload.end_period ? DateTime.fromJSDate(payload.end_period) : null,
        isShow: payload.is_show !== undefined ? payload.is_show : true,
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
      const id: number = params.id
      const clubData = await Club.findOrFail(id)

      // Convert snake_case to camelCase and handle date conversion
      const updateData: any = {}

      if (payload.name !== undefined) updateData.name = payload.name
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
      if (payload.is_registration_open !== undefined) updateData.isRegistrationOpen = payload.is_registration_open
      if (payload.registration_end_date !== undefined) {
        updateData.registrationEndDate = payload.registration_end_date
          ? DateTime.fromJSDate(payload.registration_end_date)
          : null
      }

      const updated = await clubData.merge(updateData).save()

      return response.ok({
        message: 'UPDATE_DATA_SUCCESS',
        data: updated,
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
    try {
      const club = await Club.find(clubId)
      if (!club) {
        return response.notFound({
          message: 'CLUB_NOT_FOUND',
        })
      }

      // Delete old logo if exists
      if (club.logo) {
        try {
          await drive.use().delete(club.logo)
        } catch (error) {
          // File might not exist, continue
        }
      }

      const logo = payload.file
      const fileName = `club_logo_${clubId}_${Date.now()}.${logo.extname}`
      await logo.moveToDisk(`club/${fileName}`)

      await club.merge({ logo: `club/${fileName}` }).save()

      return response.ok({
        message: 'UPLOAD_LOGO_SUCCESS',
        data: { logo: `club/${fileName}` },
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async uploadImageMedia({ request, params, response }: HttpContext) {
    const payload = await request.validateUsing(imageMediaValidator)
    const clubId = params.id
    try {
      const club = await Club.find(clubId)
      if (!club) {
        return response.notFound({
          message: 'CLUB_NOT_FOUND',
        })
      }

      const media = payload.file
      const fileName = `club_media_${clubId}_${Date.now()}.${media.extname}`
      await media.moveToDisk(`club/${fileName}`)

      // Get existing media and ensure it's properly structured
      let currentItems: MediaItem[] = []
      if (club.media && club.media.items && Array.isArray(club.media.items)) {
        currentItems = [...club.media.items]
      }

      // Add new media item
      currentItems.push({
        media_url: `club/${fileName}`,
        media_type: 'image',
      })

      const newMediaStructure = { items: currentItems }

      // Update the club with new media structure
      await club.merge({ media: newMediaStructure }).save()

      return response.ok({
        message: 'UPLOAD_MEDIA_SUCCESS',
        data: { media: newMediaStructure },
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
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

      // Extract YouTube video ID from URL and create embed URL
      const youtubeUrl = payload.media_url
      let videoId = ''

      // Handle different YouTube URL formats
      const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
      ]

      for (const pattern of patterns) {
        const match = youtubeUrl.match(pattern)
        if (match) {
          videoId = match[1]
          break
        }
      }

      if (!videoId) {
        return response.badRequest({
          message: 'INVALID_YOUTUBE_URL',
        })
      }

      const embedUrl = `https://www.youtube.com/embed/${videoId}`

      // Get existing media and ensure it's properly structured
      let currentItems: MediaItem[] = []
      if (club.media && club.media.items && Array.isArray(club.media.items)) {
        currentItems = [...club.media.items]
      }

      // Add new media item
      currentItems.push({
        media_url: embedUrl,
        media_type: 'video',
        video_source: 'youtube',
      })

      const newMediaStructure = { items: currentItems }

      // Update the club with new media structure
      await club.merge({ media: newMediaStructure }).save()

      return response.ok({
        message: 'ADD_YOUTUBE_MEDIA_SUCCESS',
        data: { media: newMediaStructure },
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
    const payload = request.all()
    const index: number = payload.index
    try {
      const club = await Club.findOrFail(clubId)

      if (
        !club.media ||
        !club.media.items ||
        !Array.isArray(club.media.items) ||
        club.media.items.length === 0
      ) {
        return response.notFound({
          message: 'MEDIA_NOT_FOUND',
        })
      }

      if (index >= club.media.items.length || index < 0) {
        return response.badRequest({
          message: 'INVALID_MEDIA_INDEX',
        })
      }

      // Delete file from storage only if it's an image (not YouTube video)
      if (club.media.items[index].media_type === 'image') {
        try {
          await drive.use().delete(club.media.items[index].media_url)
        } catch (error) {
          // File might not exist, continue with deletion
        }
      }

      // Create a copy of the media items array and remove the item
      const currentItems = [...club.media.items]
      currentItems.splice(index, 1)

      const newMediaStructure = { items: currentItems }

      // Update the club with new media structure
      await club.merge({ media: newMediaStructure }).save()

      return response.ok({
        message: 'DELETE_MEDIA_SUCCESS',
        data: { media: newMediaStructure },
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
        registration_info: payload.registration_info || "",
        after_registration_info: payload.after_registration_info || "",
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
