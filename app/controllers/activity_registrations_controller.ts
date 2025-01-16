import { HttpContext } from '@adonisjs/core/http'
import ActivityRegistration from '#models/activity_registration'
import Activity from '#models/activity'
import Excel from 'exceljs'
import Profile from '#models/profile'
import db from '@adonisjs/lucid/services/db'
import {
  updateActivityRegistrations,
  bulkUpdateActivityRegistrations,
  storeActivityRegistration,
} from '#validators/activity_validator'

export default class ActivityRegistrationsController {
  async store({ params, request, response }: HttpContext) {
    const payload = await storeActivityRegistration.validate(request.all())
    const activityId = params.id
    try {
      const userData = await Profile.findOrFail(payload.user_id)
      const activity = await Activity.findOrFail(activityId)
      const registered = await ActivityRegistration.query().where({
        user_id: payload.user_id,
        activity_id: activity.id,
      })

      if (registered && registered.length) {
        return response.conflict({
          message: 'ALREADY_REGISTERED',
        })
      }

      if (userData.level < activity.minimumLevel) {
        return response.forbidden({
          message: 'UNMATCHED_LEVEL',
        })
      }
      const registration = await ActivityRegistration.create({
        userId: payload.user_id,
        activityId: activity.id,
        status: 'TERDAFTAR',
        questionnaireAnswer: payload.questionnaire_answer,
      })

      return response.ok({
        messages: 'CREATE_DATA_SUCCESS',
        data: registration,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async show({ params, response }: HttpContext) {
    const registrationId: number = params.id
    try {
      const registration = await ActivityRegistration.findOrFail(registrationId)

      return response.ok({
        messages: 'GET_DATA_SUCCESS',
        data: registration,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async index({ params, request, response }: HttpContext) {
    const activityId = params.id
    const page = request.qs().page ?? 1
    const perPage = request.qs().per_page ?? 10
    const name = request.qs().name
    const status = request.qs().status

    try {
      const activity = await Activity.findOrFail(activityId)
      const mandatoryData = activity.additionalConfig.mandatory_profile_data
      const profileDataField = mandatoryData.map((element) => {
        return 'profiles.' + element.name
      })

      const registrations = await db
        .from('activity_registrations')
        .join('public_users', 'activity_registrations.user_id', '=', 'public_users.id')
        .join('profiles', 'activity_registrations.user_id', '=', 'profiles.user_id')
        .where('activity_registrations.activity_id', activityId)
        .where('profiles.name', 'ILIKE', name ? '%' + name + '%' : '%%')
        .where('activity_registrations.status', 'ILIKE', status ? '%' + status + '%' : '%%')
        .select(
          'activity_registrations.id',
          'public_users.id as user_id',
          'public_users.email',
          'profiles.name',
          'profiles.level',
          ...profileDataField,
          'activity_registrations.status'
        )
        .orderBy('activity_registrations.id', 'desc')
        .paginate(page, perPage)

      return response.ok({
        messages: 'GET_DATA_SUCCESS',
        data: registrations,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async updateStatus({ request, response }: HttpContext) {
    const payload = await updateActivityRegistrations.validate(request.all())
    const status: string = payload.status
    const ids: number[] = payload.registrations_id
    try {
      const affectedRows = await ActivityRegistration.query()
        .whereIn('id', ids)
        .update({ status: status })
      return response.ok({
        messages: 'UPDATE_DATA_SUCCESS',
        affected_rows: affectedRows,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async updateStatusBulk({ params, request, response }: HttpContext) {
    const activityId = params.id
    const payload = await bulkUpdateActivityRegistrations.validate(request.all())
    const clause: {
      name?: string
      status?: string
    } = {}

    if (payload.name) clause.name = payload.name
    if (payload.current_status) clause.status = payload.current_status

    try {
      const affectedRows = await ActivityRegistration.query()
        .where('activity_id', activityId)
        .where(clause)
        .update({ status: payload.new_status })
      return response.ok({
        messages: 'UPDATE_DATA_SUCCESS',
        affected_rows: affectedRows,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async export({ params, response }: HttpContext) {
    const activityId = params.id
    try {
      const activity = await Activity.findOrFail(activityId)
      const registrations = await ActivityRegistration.query()
        .where({ activityId: activityId })
        .preload('publicUser')
        .select('*')

      if (!registrations) {
        return response.notFound({
          message: 'REGISTRATIONS_NOT_AVAILABLE',
        })
      }

      const workbook = new Excel.Workbook()
      const worksheet = workbook.addWorksheet('Sheet 1')
      const font = { name: 'Arial', size: 12 }

      worksheet.columns = [
        { header: 'No', key: 'no', width: 5, style: { font: font } },
        { header: 'Name', key: 'name', width: 40, style: { font: font } },
        { header: 'Gender', key: 'gender', width: 7, style: { font: font } },
        { header: 'Email', key: 'email', width: 30, style: { font: font } },
        { header: 'Whatsapp', key: 'whatsapp', width: 20, style: { font: font } },
        { header: 'Personal ID', key: 'personal_id', width: 15, style: { font: font } },
        { header: 'Line ID', key: 'line', width: 15, style: { font: font } },
        { header: 'Instagram', key: 'instagram', width: 15, style: { font: font } },
        { header: 'TikTok', key: 'tiktok', width: 15, style: { font: font } },
        { header: 'LinkedIn', key: 'linkedin', width: 15, style: { font: font } },
        {
          header: 'Province',
          key: 'province',
          width: 25,
          style: { font: font },
        },
        { header: 'City', key: 'city', width: 40, style: { font: font } },
        {
          header: 'University',
          key: 'university',
          width: 50,
          style: { font: font },
        },
        { header: 'Major', key: 'major', width: 40, style: { font: font } },
        {
          header: 'Intake Year',
          key: 'intake_year',
          width: 13,
          style: { font: font },
        },
        { header: 'Role', key: 'level', width: 15, style: { font: font } },
      ]

      const questions: Array<{
        label: string
        name: string
        type: string
        required: boolean
        data?: Array<{ id: number; label: string; value: string }>
      }> = activity.additionalConfig.additional_questionnaire

      const keys: string[] = []
      questions.forEach((question) => {
        worksheet.columns = [
          ...worksheet.columns,
          {
            header: question.label,
            key: question.name,
            width: 20,
            style: { font: font },
          },
        ]
        keys.push(question.name) // store keys for worksheet.addRow
      })

      var provinceName: string = ''
      var cityName: string = ''
      var universityName: string = ''

      for (let [i, item] of registrations.entries()) {
        let profile = await Profile.query()
          .where('user_id', item.publicUser.id)
          .preload('province')
          .preload('city')
          .preload('university')
          .firstOrFail()

        if (profile.province) provinceName = profile.province.name
        if (profile.city) cityName = profile.city.name
        if (profile.university) universityName = profile.university.name

        let profileRowData = {
          no: i + 1,
          name: profile.name,
          gender: profile.gender,
          email: item.publicUser.email,
          whatsapp: profile.whatsapp,
          personal_id: profile.personal_id,
          line: profile.line,
          instagram: profile.instagram,
          tiktok: profile.tiktok,
          linkedin: profile.linkedin,
          province: provinceName,
          city: cityName,
          university: universityName,
          major: profile.major,
          intake_year: profile.intakeYear,
          level: profile.level,
        }
        /*

        questionnaireAnswer sample:

        {
          "0":"Jawaban 1",
          "1":"Jawaban 2",
          "2":"Jawaban 3",
          "3":"Jawaban 4",
        }

        */

        const answers: { [index: string]: string } = item.questionnaireAnswer
        const values: string[] = Object.values(answers)
        const answerRowData: { [key: string]: string } = {}
        for (const [index, key] of keys.entries()) {
          answerRowData[key] = values[index]
        }
        const rowData = { ...profileRowData, ...answerRowData }
        worksheet.addRow(rowData)
      }

      const buffer = await workbook.xlsx.writeBuffer()

      return response
        .status(200)
        .safeHeader('Content-type', 'application/vnd-ms-excel')
        .safeHeader(
          'Content-Disposition',
          `attachment; filename=${activity.name.replace(/ /g, '-')}.xls`
        )
        .send(buffer)
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.stack,
      })
    }
  }

  async delete({ params, response }: HttpContext) {
    const id = params.id
    try {
      const registration = await ActivityRegistration.find(id)
      if (!registration) {
        return response.ok({
          message: 'REGISTRATION_NOT_FOUND',
        })
      }
      await ActivityRegistration.query().where('id', id).delete()
      return response.ok({
        message: 'DELETE_DATA_SUCCESS',
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }
}
