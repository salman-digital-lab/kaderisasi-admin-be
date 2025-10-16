import { HttpContext } from '@adonisjs/core/http'
import ClubRegistration from '#models/club_registration'
import Club from '#models/club'
import PublicUser from '#models/public_user'
import {
  storeClubRegistrationValidator,
  updateClubRegistrationValidator,
  bulkUpdateClubRegistrationsValidator,
} from '#validators/club_registration_validator'
import ExcelJS from 'exceljs'
import Profile from '#models/profile'

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
   * Export club registrations to XLSX
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

      // Check if club has a custom form attached
      const CustomForm = (await import('#models/custom_form')).default
      const customForm = await CustomForm.query()
        .where('feature_type', 'club_registration')
        .where('feature_id', clubId)
        .where('is_active', true)
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
        'Status',
        'Tanggal Pendaftaran',
      ]

      let questionHeaders: string[] = []
      let questionKeys: string[] = []

      if (customForm) {
        // Use custom form schema
        const formSchema = customForm.formSchema

        // Extract all fields from all sections, excluding the profile_data section
        for (const section of formSchema.fields) {
          if (section.section_name === 'profile_data') {
            continue
          }

          for (const field of section.fields) {
            questionHeaders.push(field.label)
            questionKeys.push(field.key)
          }
        }
      }

      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Registrations')

      // Add headers
      const allHeaders = [...baseHeaders, ...questionHeaders]
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
          registration.status,
          registration.createdAt.toFormat('yyyy-MM-dd HH:mm:ss'),
        ]

        // Add questionnaire answers if custom form exists
        const answers = registration.additionalData || {}
        const answerValues = questionKeys.map((key) => answers[key] || '')

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
        .header('Content-Disposition', `attachment; filename="${sanitizedFileName}_registrations.xlsx"`)
        .send(buffer)
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }


}