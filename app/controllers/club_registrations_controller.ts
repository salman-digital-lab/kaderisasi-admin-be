import { HttpContext } from '@adonisjs/core/http'
import ClubRegistration from '#models/club_registration'
import Club from '#models/club'
import PublicUser from '#models/public_user'
import {
  storeClubRegistrationValidator,
  updateClubRegistrationValidator,
  bulkUpdateClubRegistrationsValidator,
} from '#validators/club_registration_validator'

export default class ClubRegistrationsController {
  /**
   * Get all registrations for a specific club
   */
  async index({ params, request, response }: HttpContext) {
    try {
      const clubId = params.id
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const status = request.input('status')

      const club = await Club.findOrFail(clubId)

      const query = ClubRegistration.query()
        .where('club_id', club.id)
        .preload('member', (query) => {
          query.preload('profile')
        })
        .orderBy('created_at', 'desc')

      if (status) {
        query.where('status', status)
      }

      const registrations = await query.paginate(page, limit)

      return response.ok({
        message: 'CLUB_REGISTRATIONS_RETRIEVED',
        data: registrations,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  /**
   * Create a new club registration (admin can register members)
   */
  async store({ params, request, response }: HttpContext) {
    try {
      const clubId = params.id
      const payload = await storeClubRegistrationValidator.validate(request.all())

      const club = await Club.findOrFail(clubId)
      const member = await PublicUser.findOrFail(payload.member_id)

      // Check if already registered
      const existingRegistration = await ClubRegistration.query()
        .where('club_id', club.id)
        .where('member_id', member.id)
        .first()

      if (existingRegistration) {
        return response.conflict({
          message: 'MEMBER_ALREADY_REGISTERED',
        })
      }

      const registration = await ClubRegistration.create({
        clubId: club.id,
        memberId: member.id,
        status: 'PENDING',
        additionalData: payload.additional_data || {},
      })

      await registration.load('member')
      await registration.load('club')

      return response.ok({
        message: 'CLUB_REGISTRATION_CREATED',
        data: registration,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  /**
   * Get a specific registration
   */
  async show({ params, response }: HttpContext) {
    try {
      const registrationId = params.id

      const registration = await ClubRegistration.query()
        .where('id', registrationId)
        .preload('member', (query) => {
          query.preload('profile')
        })
        .preload('club')
        .firstOrFail()

      return response.ok({
        message: 'CLUB_REGISTRATION_RETRIEVED',
        data: registration,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  /**
   * Update registration status and additional data
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const registrationId = params.id
      const payload = await updateClubRegistrationValidator.validate(request.all())

      const registration = await ClubRegistration.findOrFail(registrationId)

      registration.status = payload.status
      if (payload.additional_data) {
        registration.additionalData = payload.additional_data
      }

      await registration.save()
      await registration.load('member')
      await registration.load('club')

      return response.ok({
        message: 'CLUB_REGISTRATION_UPDATED',
        data: registration,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  /**
   * Bulk update registrations status
   */
  async bulkUpdate({ request, response }: HttpContext) {
    
    try {
      const payload = await bulkUpdateClubRegistrationsValidator.validate(request.all())

      const updatedRegistrations = []

      for (const registrationData of payload.registrations) {
        const registration = await ClubRegistration.findOrFail(registrationData.id)
        registration.status = registrationData.status
        if (registrationData.additional_data) {
          registration.additionalData = registrationData.additional_data
        }
        await registration.save()
        await registration.load('member')
        await registration.load('club')
        updatedRegistrations.push(registration)
      }

      return response.ok({
        message: 'CLUB_REGISTRATIONS_BULK_UPDATED',
        data: updatedRegistrations,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  /**
   * Delete a registration
   */
  async delete({ params, response }: HttpContext) {
    try {
      const registrationId = params.id

      const registration = await ClubRegistration.findOrFail(registrationId)
      await registration.delete()

      return response.ok({
        message: 'CLUB_REGISTRATION_DELETED',
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  /**
   * Export club registrations to CSV
   */
  async export({ params, response }: HttpContext) {
    try {
      const clubId = params.id
      const club = await Club.findOrFail(clubId)

      const registrations = await ClubRegistration.query()
        .where('club_id', club.id)
        .preload('member', (query) => {
          query.preload('profile')
        })
        .orderBy('created_at', 'desc')

      // Create CSV content
      const csvHeaders = [
        'ID',
        'Member Name',
        'Email',
        'Status',
        'Registration Date',
        'Additional Data',
      ]

      const csvRows = registrations.map((registration) => [
        registration.id,
        registration.member.profile?.name || 'N/A',
        registration.member.email,
        registration.status,
        registration.createdAt.toFormat('yyyy-MM-dd HH:mm:ss'),
        JSON.stringify(registration.additionalData),
      ])

      const csvContent = [csvHeaders, ...csvRows]
        .map((row) => row.map((field) => `"${field}"`).join(','))
        .join('\n')

      response.header('Content-Type', 'text/csv')
      response.header('Content-Disposition', `attachment; filename="${club.name}_registrations.csv"`)

      return response.send(csvContent)
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }


}