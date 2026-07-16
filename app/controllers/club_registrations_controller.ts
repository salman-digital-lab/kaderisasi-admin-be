import { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import ClubRegistration from '#models/club_registration'
import Club from '#models/club'
import PublicUser from '#models/public_user'
import {
  storeClubRegistrationValidator,
  updateClubRegistrationValidator,
  bulkUpdateClubRegistrationsValidator,
} from '#validators/club_registration_validator'
import { USER_LEVEL_ENUM } from '../../types/constants/profile.js'
import ExcelJS from 'exceljs'
import {
  buildClubRegistrationQuestionColumns,
  formatClubRegistrationAnswer,
} from '#services/club_registration_export_service'

export default class ClubRegistrationsController {
  // Convert the numeric profile level into a human-readable kaderisasi level label
  private getLevelLabel(level: number): string {
    switch (level) {
      case USER_LEVEL_ENUM.JAMAAH:
        return 'JAMAAH'
      case USER_LEVEL_ENUM.AKTIVIS:
        return 'AKTIVIS'
      case USER_LEVEL_ENUM.KADER:
        return 'KADER'
      case USER_LEVEL_ENUM.KADER_LANJUT:
        return 'KADER LANJUT'
      default:
        return String(level)
    }
  }

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
        .preload('member', (memberQuery) => {
          memberQuery.preload('profile')
        })
        .preload('roles', (roleQuery) => {
          roleQuery.orderBy('sort_order', 'asc').orderBy('is_primary', 'desc')
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
   * Get approved members for a specific club.
   */
  async members({ params, request, response }: HttpContext) {
    try {
      const clubId = params.id
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const search = request.input('search')

      const club = await Club.findOrFail(clubId)

      const query = ClubRegistration.query()
        .where('club_id', club.id)
        .where('status', 'APPROVED')
        .preload('member', (memberQuery) => {
          memberQuery.preload('profile')
        })
        .preload('roles', (roleQuery) => {
          roleQuery
            .orderBy('sort_order', 'asc')
            .orderBy('is_primary', 'desc')
            .orderBy('created_at', 'asc')
        })
        .orderBy('created_at', 'desc')

      if (search) {
        query.whereHas('member', (memberQuery) => {
          memberQuery
            .where('email', 'ILIKE', `%${search}%`)
            .orWhereHas('profile', (profileQuery) => {
              profileQuery.where('name', 'ILIKE', `%${search}%`)
            })
        })
      }

      const members = await query.paginate(page, limit)

      return response.ok({
        message: 'CLUB_MEMBERS_RETRIEVED',
        data: members,
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
        .preload('roles', (query) => {
          query.orderBy('sort_order', 'asc').orderBy('is_primary', 'desc')
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

      const registrationIds = payload.registrations.map((r) => r.id)
      const uniqueRegistrationIds = [...new Set(registrationIds)]

      if (uniqueRegistrationIds.length !== registrationIds.length) {
        return response.badRequest({ message: 'DUPLICATE_REGISTRATION_IDS' })
      }

      let missingRegistrationIds: number[] = []
      let updatedRegistrations: ClubRegistration[] = []

      await db.transaction(async (trx) => {
        const registrations = await ClubRegistration.query({ client: trx })
          .whereIn('id', uniqueRegistrationIds)
          .preload('member')
          .preload('club')
          .forUpdate()
        const registrationMap = new Map(
          registrations.map((registration) => [registration.id, registration])
        )

        missingRegistrationIds = uniqueRegistrationIds.filter((id) => !registrationMap.has(id))
        if (missingRegistrationIds.length > 0) {
          return
        }

        for (const registrationData of payload.registrations) {
          const registration = registrationMap.get(registrationData.id)!
          registration.useTransaction(trx)
          registration.status = registrationData.status
          if (registrationData.additional_data) {
            registration.additionalData = registrationData.additional_data
          }
          await registration.save()
        }

        updatedRegistrations = registrationIds.map((id) => registrationMap.get(id)!)
      })

      if (missingRegistrationIds.length > 0) {
        return response.notFound({
          message: 'REGISTRATIONS_NOT_FOUND',
          ids: missingRegistrationIds,
        })
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
   * Export club registrations to XLSX
   */
  async export({ params, response }: HttpContext) {
    try {
      const clubId = params.id
      const club = await Club.findOrFail(clubId)

      const registrations = await ClubRegistration.query()
        .where('club_id', club.id)
        .preload('member', (query) => {
          query.preload('profile', (profileQuery) => {
            profileQuery.preload('province')
            profileQuery.preload('university')
          })
        })
        .orderBy('created_at', 'desc')

      // Check if club has a custom form attached
      const { default: CustomForm } = await import('#models/custom_form')
      const customForm = await CustomForm.query()
        .where('feature_type', 'club_registration')
        .where('feature_id', clubId)
        .where('is_active', true)
        .orderBy('updated_at', 'desc')
        .orderBy('id', 'desc')
        .first()

      // Define base headers
      const baseHeaders = [
        'No',
        'Nama Lengkap',
        'Email',
        'Whatsapp',
        'Nomor Identitas',
        'Provinsi',
        'Universitas',
        'Jurusan',
        'Tahun Masuk',
        'Jenjang',
        'Status',
        'Tanggal Pendaftaran',
      ]

      const questionColumns = buildClubRegistrationQuestionColumns(
        customForm?.formSchema,
        registrations.map((registration) => registration.additionalData)
      )

      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Registrations')

      // Add headers
      const allHeaders = [...baseHeaders, ...questionColumns.map((column) => column.label)]
      worksheet.addRow(allHeaders)

      // Style the header row
      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      }

      // Process each registration
      for (let [i, registration] of registrations.entries()) {
        const profile = registration.member.profile

        const baseData = [
          i + 1,
          profile?.name || '',
          registration.member.email || '',
          profile?.whatsapp || '',
          profile?.personal_id || '',
          profile?.province?.name || '',
          profile?.university?.name || '',
          profile?.major || '',
          profile?.intakeYear || '',
          profile ? this.getLevelLabel(profile.level || 0) : '',
          registration.status,
          registration.createdAt.toFormat('yyyy-MM-dd HH:mm:ss'),
        ]

        const answers = registration.additionalData || {}
        const answerValues = questionColumns.map((column) =>
          formatClubRegistrationAnswer(answers[column.key])
        )

        // Add row to worksheet
        worksheet.addRow([...baseData, ...answerValues])
      }

      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        let maxLength = 0
        column.eachCell?.({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10
          if (columnLength > maxLength) {
            maxLength = columnLength
          }
        })
        column.width = maxLength < 10 ? 10 : maxLength > 50 ? 50 : maxLength + 2
      })

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer()

      // Use the correct content type and filename
      const sanitizedFileName = club.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')

      return response
        .status(200)
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header(
          'Content-Disposition',
          `attachment; filename="${sanitizedFileName}_registrations.xlsx"`
        )
        .send(buffer)
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }
}
