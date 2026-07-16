import { HttpContext } from '@adonisjs/core/http'
import ActivityRegistration from '#models/activity_registration'
import Activity from '#models/activity'
import Profile from '#models/profile'
import db from '@adonisjs/lucid/services/db'
import {
  updateActivityRegistrations,
  bulkUpdateActivityRegistrations,
  storeActivityRegistration,
  updateActivityRegistrationsByEmail,
} from '#validators/activity_validator'

import { ACTIVITY_REGISTRANT_STATUS_ENUM } from '../../types/constants/activity.js'
import {
  ACTIVITY_LEVEL_UPGRADE_MAP,
  ACTIVITY_TYPE_SPECIAL,
} from '../constants/activity_registration.js'
import PublicUser from '#models/public_user'
import { USER_LEVEL_ENUM } from '../../types/constants/profile.js'
import ExcelJS from 'exceljs'
import Province from '#models/province'
import City from '#models/city'
import University from '#models/university'
import IssuedCertificate from '#models/issued_certificate'

type ExportEducationEntry = {
  degree?: string
  institution?: string
  faculty?: string
  major?: string
  intake_year?: number
}

type ExportWorkEntry = {
  job_title?: string
  company?: string
  start_year?: number
  end_year?: number
}

type ExportRegistrantIdentity = {
  name: string
  email: string
  picture: string
  whatsapp: string
  gender: string
  personalId: string
  birthDate: string
  line: string
  instagram: string
  tiktok: string
  linkedin: string
  province: string
  city: string
  country: string
  originProvince: string
  originCity: string
  university: string
  major: string
  intakeYear: string
  level: string
  profileBadges: string
  educationHistory: string
  workHistory: string
  extraData: string
}

type ExportLocationMaps = {
  provinces: Map<number, string>
  cities: Map<number, string>
  universities: Map<number, string>
}

const REGISTRATION_EXPORT_HEADERS = [
  'No',
  'Nama Lengkap',
  'Jenis Kelamin',
  'Email',
  'Foto Profil',
  'Whatsapp',
  'Nomor Identitas',
  'Tanggal Lahir',
  'Line ID',
  'Instagram',
  'TikTok',
  'LinkedIn',
  'Provinsi Domisili',
  'Kota Domisili',
  'Negara Domisili',
  'Provinsi Asal',
  'Kota Asal',
  'Kampus/Universitas Profil',
  'Jurusan Profil',
  'Tahun Masuk Profil',
  'Institusi Pendidikan Saat Ini',
  'Fakultas Pendidikan Saat Ini',
  'Jurusan Pendidikan Saat Ini',
  'Tahun Masuk Pendidikan Saat Ini',
  'Riwayat Pendidikan',
  'Riwayat Pekerjaan',
  'Data Tambahan',
  'Jenjang',
  'Lencana Profil',
  'Lencana Kegiatan',
]

export default class ActivityRegistrationsController {
  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  private getErrorStack(error: unknown): string {
    return error instanceof Error ? error.stack || error.message : String(error)
  }

  private stringifyValue(value: unknown): string {
    if (value === null || value === undefined) {
      return ''
    }

    if (typeof value === 'string') {
      return value
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }

    return JSON.stringify(value)
  }

  private getStringValue(value: unknown): string {
    return this.stringifyValue(value)
  }

  private getGuestStringValue(guestData: Record<string, unknown> | null, key: string): string {
    return this.getStringValue(guestData?.[key])
  }

  private formatDate(value: Date | string | null | undefined): string {
    if (!value) {
      return ''
    }

    if (value instanceof Date) {
      return value.toISOString().split('T')[0]
    }

    return value.split('T')[0]
  }

  private formatEducationEntry(entry: ExportEducationEntry): string {
    return [
      entry.degree,
      entry.institution,
      entry.faculty,
      entry.major,
      entry.intake_year ? String(entry.intake_year) : undefined,
    ]
      .filter(Boolean)
      .join(' - ')
  }

  private formatEducationHistory(value: unknown): string {
    if (!Array.isArray(value)) {
      return this.stringifyValue(value)
    }

    return value
      .map((entry) => this.formatEducationEntry(entry as ExportEducationEntry))
      .filter(Boolean)
      .join('; ')
  }

  private formatWorkEntry(entry: ExportWorkEntry): string {
    return [
      entry.job_title,
      entry.company,
      entry.start_year ? String(entry.start_year) : undefined,
      entry.end_year ? String(entry.end_year) : undefined,
    ]
      .filter(Boolean)
      .join(' - ')
  }

  private formatWorkHistory(value: unknown): string {
    if (!Array.isArray(value)) {
      return this.stringifyValue(value)
    }

    return value
      .map((entry) => this.formatWorkEntry(entry as ExportWorkEntry))
      .filter(Boolean)
      .join('; ')
  }

  private getNumericGuestValue(
    guestData: Record<string, unknown> | null,
    key: string
  ): number | null {
    const value = guestData?.[key]

    if (typeof value === 'number') {
      return value
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      return Number.isNaN(parsed) ? null : parsed
    }

    return null
  }

  private getLocationName(
    profileValue: string | undefined,
    guestData: Record<string, unknown> | null,
    guestKey: string,
    locationMap: Map<number, string>
  ): string {
    if (profileValue) {
      return profileValue
    }

    const guestId = this.getNumericGuestValue(guestData, guestKey)
    return guestId ? locationMap.get(guestId) || '' : ''
  }

  private async getGuestLocationMaps(
    registrations: ActivityRegistration[]
  ): Promise<ExportLocationMaps> {
    const provinceIds = new Set<number>()
    const cityIds = new Set<number>()
    const universityIds = new Set<number>()

    for (const registration of registrations) {
      if (registration.userId !== null) {
        continue
      }

      const provinceId = this.getNumericGuestValue(registration.guestData, 'province_id')
      const cityId = this.getNumericGuestValue(registration.guestData, 'city_id')
      const originProvinceId = this.getNumericGuestValue(
        registration.guestData,
        'origin_province_id'
      )
      const originCityId = this.getNumericGuestValue(registration.guestData, 'origin_city_id')
      const universityId = this.getNumericGuestValue(registration.guestData, 'university_id')

      if (provinceId) {
        provinceIds.add(provinceId)
      }
      if (cityId) {
        cityIds.add(cityId)
      }
      if (originProvinceId) {
        provinceIds.add(originProvinceId)
      }
      if (originCityId) {
        cityIds.add(originCityId)
      }
      if (universityId) {
        universityIds.add(universityId)
      }
    }

    const [provinces, cities, universities] = await Promise.all([
      provinceIds.size > 0 ? Province.query().whereIn('id', [...provinceIds]) : [],
      cityIds.size > 0 ? City.query().whereIn('id', [...cityIds]) : [],
      universityIds.size > 0 ? University.query().whereIn('id', [...universityIds]) : [],
    ])

    return {
      provinces: new Map(provinces.map((province) => [province.id, province.name])),
      cities: new Map(cities.map((city) => [city.id, city.name])),
      universities: new Map(universities.map((university) => [university.id, university.name])),
    }
  }

  private getCurrentEducationEntry(
    profile?: Profile | null,
    guestData?: Record<string, unknown> | null
  ): ExportEducationEntry | undefined {
    const history = profile?.educationHistory
    const latestEducation = history?.[history.length - 1]

    if (latestEducation) {
      return latestEducation
    }

    return guestData?.current_education as ExportEducationEntry | undefined
  }

  private getRegistrantIdentity(
    registration: ActivityRegistration,
    profile: Profile | null | undefined,
    locationMaps: ExportLocationMaps
  ): ExportRegistrantIdentity {
    const isGuest = registration.userId === null
    const guestData = registration.guestData

    return {
      name: isGuest ? this.getGuestStringValue(guestData, 'name') : profile?.name || '',
      email: isGuest
        ? this.getGuestStringValue(guestData, 'email')
        : registration.publicUser?.email || '',
      picture: profile?.picture || '',
      whatsapp: isGuest ? this.getGuestStringValue(guestData, 'whatsapp') : profile?.whatsapp || '',
      gender: profile?.gender || '',
      personalId: profile?.personal_id || '',
      birthDate: this.formatDate(
        isGuest ? this.getGuestStringValue(guestData, 'birth_date') : profile?.birthDate
      ),
      line: profile?.line || '',
      instagram: profile?.instagram || '',
      tiktok: profile?.tiktok || '',
      linkedin: profile?.linkedin || '',
      province: this.getLocationName(
        profile?.province?.name,
        guestData,
        'province_id',
        locationMaps.provinces
      ),
      city: this.getLocationName(profile?.city?.name, guestData, 'city_id', locationMaps.cities),
      country: isGuest ? this.getGuestStringValue(guestData, 'country') : profile?.country || '',
      originProvince: this.getLocationName(
        profile?.originProvince?.name,
        guestData,
        'origin_province_id',
        locationMaps.provinces
      ),
      originCity: this.getLocationName(
        profile?.originCity?.name,
        guestData,
        'origin_city_id',
        locationMaps.cities
      ),
      university: this.getLocationName(
        profile?.university?.name,
        guestData,
        'university_id',
        locationMaps.universities
      ),
      major: isGuest ? this.getGuestStringValue(guestData, 'major') : profile?.major || '',
      intakeYear: String((isGuest ? guestData?.intake_year : profile?.intakeYear) || ''),
      level: isGuest ? 'Tamu' : this.getLevelLabel(profile?.level || 0),
      profileBadges: profile?.badges?.join(', ') || '',
      educationHistory: this.formatEducationHistory(
        isGuest ? guestData?.education_history : profile?.educationHistory
      ),
      workHistory: this.formatWorkHistory(profile?.workHistory),
      extraData: this.stringifyValue(profile?.extraData),
    }
  }

  private buildRegistrationExportRow(
    rowNumber: number,
    registration: ActivityRegistration,
    questionKeys: string[],
    activityBadge: string,
    locationMaps: ExportLocationMaps
  ): Array<string | number> {
    const profile = registration.publicUser?.profile
    const identity = this.getRegistrantIdentity(registration, profile, locationMaps)
    const currentEducation = this.getCurrentEducationEntry(profile, registration.guestData)
    const answers = registration.questionnaireAnswer
    const answerValues = questionKeys.map((key) => this.getStringValue(answers[key]))

    return [
      rowNumber,
      identity.name,
      identity.gender,
      identity.email,
      identity.picture,
      identity.whatsapp,
      identity.personalId,
      identity.birthDate,
      identity.line,
      identity.instagram,
      identity.tiktok,
      identity.linkedin,
      identity.province,
      identity.city,
      identity.country,
      identity.originProvince,
      identity.originCity,
      identity.university,
      identity.major,
      identity.intakeYear,
      currentEducation?.institution || '',
      currentEducation?.faculty || '',
      currentEducation?.major || '',
      currentEducation?.intake_year || '',
      identity.educationHistory,
      identity.workHistory,
      identity.extraData,
      identity.level,
      identity.profileBadges,
      activityBadge,
      ...answerValues,
    ]
  }

  // Helper function to convert level number to label
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

  async store({ params, request, response }: HttpContext) {
    const payload = await storeActivityRegistration.validate(request.all())
    const activityId = params.id
    try {
      const userData = await Profile.findOrFail(payload.user_id)
      const activity = await Activity.findOrFail(activityId)
      const registered = await ActivityRegistration.query().where({
        user_id: userData.userId,
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
        userId: userData.userId,
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
        error: this.getErrorMessage(error),
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
        error: this.getErrorMessage(error),
      })
    }
  }

  async index({ params, request, response }: HttpContext) {
    const activityId = params.id
    const page = request.qs().page ?? 1
    const perPage = request.qs().per_page ?? 10
    const search = request.qs().search // Combined search for name and email
    const status = request.qs().status
    const universityId = request.qs().university_id
    const provinceId = request.qs().province_id
    const intakeYear = request.qs().intake_year
    const sortBy = request.qs().sort_by ?? 'name'
    const sortOrder = request.qs().sort_order ?? 'asc'

    // Map frontend sort field names to database column names
    const sortFieldMap: Record<string, string> = {
      name: 'profiles.name',
      email: 'public_users.email',
      status: 'activity_registrations.status',
      level: 'profiles.level',
      university_id: 'profiles.university_id',
      province_id: 'profiles.province_id',
      intake_year: 'profiles.intake_year',
      major: 'profiles.major',
      whatsapp: 'profiles.whatsapp',
    }

    const sortColumn = sortFieldMap[sortBy] || 'profiles.name'
    const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc'

    try {
      const activity = await Activity.findOrFail(activityId)
      const mandatoryData = activity.additionalConfig.mandatory_profile_data
      const profileDataField = mandatoryData.map((element) => {
        return 'profiles.' + element.name
      })

      let query = db
        .from('activity_registrations')
        .leftJoin('public_users', 'activity_registrations.user_id', '=', 'public_users.id')
        .leftJoin('profiles', 'activity_registrations.user_id', '=', 'profiles.user_id')
        .where('activity_registrations.activity_id', activityId)

      // Apply filters
      if (search) {
        query = query.where((builder) => {
          builder
            .where('profiles.name', 'ILIKE', '%' + search + '%')
            .orWhere('public_users.email', 'ILIKE', '%' + search + '%')
            .orWhereRaw("activity_registrations.guest_data->>'name' ILIKE ?", ['%' + search + '%'])
            .orWhereRaw("activity_registrations.guest_data->>'email' ILIKE ?", ['%' + search + '%'])
        })
      }
      if (status) {
        query = query.where('activity_registrations.status', 'ILIKE', '%' + status + '%')
      }
      if (universityId) {
        query = query.where('profiles.university_id', universityId)
      }
      if (provinceId) {
        query = query.where('profiles.province_id', provinceId)
      }
      if (intakeYear) {
        query = query.where('profiles.intake_year', intakeYear)
      }

      const registrations = await query
        .select(
          'activity_registrations.id',
          'public_users.id as user_id',
          db.raw(
            "COALESCE(public_users.email, activity_registrations.guest_data->>'email') as email"
          ),
          db.raw("COALESCE(profiles.name, activity_registrations.guest_data->>'name') as name"),
          'profiles.level',
          'profiles.university_id',
          'profiles.province_id',
          'profiles.intake_year',
          'profiles.major',
          db.raw(
            "COALESCE(profiles.gender, activity_registrations.guest_data->>'gender') as gender"
          ),
          db.raw(
            "COALESCE(profiles.whatsapp, activity_registrations.guest_data->>'whatsapp') as whatsapp"
          ),
          'profiles.instagram',
          'profiles.line',
          'profiles.personal_id',
          'profiles.education_history',
          'activity_registrations.guest_data',
          ...profileDataField,
          'activity_registrations.status',
          'activity_registrations.created_at'
        )
        .orderBy(sortColumn, sortDirection)
        .paginate(page, perPage)

      return response.ok({
        messages: 'GET_DATA_SUCCESS',
        data: registrations,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: this.getErrorMessage(error),
      })
    }
  }

  async statistics({ params, response }: HttpContext) {
    const activityId = params.id

    try {
      // Get total count and counts by status
      const statusCounts = await db
        .from('activity_registrations')
        .where('activity_id', activityId)
        .select('status')
        .count('* as count')
        .groupBy('status')

      const totalCount = await db
        .from('activity_registrations')
        .where('activity_id', activityId)
        .count('* as total')
        .first()

      // Transform to a more usable format
      const byStatus: Record<string, number> = {}
      for (const row of statusCounts) {
        byStatus[row.status] = Number(row.count)
      }

      return response.ok({
        messages: 'GET_DATA_SUCCESS',
        data: {
          total: Number(totalCount?.total || 0),
          by_status: byStatus,
        },
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: this.getErrorMessage(error),
      })
    }
  }

  async getActivityByUserId({ response, params }: HttpContext) {
    try {
      const id = params.id
      const activities = await ActivityRegistration.query()
        .select('*')
        .where('user_id', id)
        .preload('activity')

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: activities,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: this.getErrorStack(error),
      })
    }
  }

  async updateStatus({ request, response }: HttpContext) {
    const payload = await updateActivityRegistrations.validate(request.all())
    const status: string = payload.status
    const ids: number[] = payload.registrations_id
    try {
      const registration = await ActivityRegistration.findOrFail(ids[0])
      const activity = await registration.related('activity').query().firstOrFail()
      const { activityType } = activity

      // Start transaction
      const trx = await db.transaction()
      try {
        if (
          ACTIVITY_TYPE_SPECIAL.includes(activityType) &&
          status === ACTIVITY_REGISTRANT_STATUS_ENUM.LULUS_KEGIATAN
        ) {
          const paginatedRegistrations = await ActivityRegistration.query({ client: trx })
            .select('user_id')
            .whereIn('id', ids)
            .paginate(1, ids.length)
          const userIds = paginatedRegistrations.all()

          const resolvedUserIds = userIds
            .map((user) => user.userId)
            .filter((id): id is number => id !== null)

          // Update level
          await Profile.query({ client: trx })
            .whereIn('user_id', resolvedUserIds)
            .update({
              level:
                ACTIVITY_LEVEL_UPGRADE_MAP[activityType as keyof typeof ACTIVITY_LEVEL_UPGRADE_MAP],
            })

          // Update badges by appending new badge (batch fetch profiles to avoid N+1)
          if (activity.badge) {
            const profiles = await Profile.query({ client: trx }).whereIn(
              'user_id',
              resolvedUserIds
            )

            for (const profile of profiles) {
              const currentBadges = profile.badges ?? []
              if (!currentBadges.includes(activity.badge)) {
                await profile
                  .merge({
                    badges: [...currentBadges, activity.badge],
                  })
                  .save()
              }
            }
          }
        }

        const affectedRows = await ActivityRegistration.query({ client: trx })
          .whereIn('id', ids)
          .update({ status: status })

        // Commit transaction
        await trx.commit()

        return response.ok({
          messages: 'UPDATE_DATA_SUCCESS',
          affected_rows: affectedRows,
        })
      } catch (error) {
        // Rollback transaction on error
        await trx.rollback()
        throw error
      }
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: this.getErrorMessage(error),
      })
    }
  }

  async updateStatusByListOfEmail({ params, request, response }: HttpContext) {
    const activityId = params.id
    const payload = await updateActivityRegistrationsByEmail.validate(request.all())
    const status: string = payload.status

    try {
      // Get activity to check activity type
      const activity = await Activity.findOrFail(activityId)
      const { activityType } = activity

      // Start transaction
      const trx = await db.transaction()

      try {
        // Get user_ids from the emails
        const users = await PublicUser.query({ client: trx })
          .whereIn('email', payload.emails)
          .select('id')

        if (users.length === 0) {
          return response.notFound({
            message: 'NO_USERS_FOUND',
          })
        }

        const userIds = users.map((user) => user.id)

        // Get registrations for these users in this activity
        const registrations = await ActivityRegistration.query({ client: trx })
          .whereIn('user_id', userIds)
          .where('activity_id', activityId)

        if (registrations.length === 0) {
          return response.notFound({
            message: 'NO_REGISTRATIONS_FOUND',
          })
        }

        // Special logic for activity types that upgrade user level
        if (
          ACTIVITY_TYPE_SPECIAL.includes(activityType) &&
          status === ACTIVITY_REGISTRANT_STATUS_ENUM.LULUS_KEGIATAN
        ) {
          // Update level
          await Profile.query({ client: trx })
            .whereIn('user_id', userIds)
            .update({
              level:
                ACTIVITY_LEVEL_UPGRADE_MAP[activityType as keyof typeof ACTIVITY_LEVEL_UPGRADE_MAP],
            })

          // Update badges by appending new badge (batch fetch profiles to avoid N+1)
          if (activity.badge) {
            const profiles = await Profile.query({ client: trx }).whereIn('user_id', userIds)

            for (const profile of profiles) {
              const currentBadges = profile.badges ?? []
              if (!currentBadges.includes(activity.badge)) {
                await profile
                  .merge({
                    badges: [...currentBadges, activity.badge],
                  })
                  .save()
              }
            }
          }
        }

        // Update the status for all matching registrations
        const affectedRows = await ActivityRegistration.query({ client: trx })
          .whereIn('user_id', userIds)
          .where('activity_id', activityId)
          .update({ status: payload.status })

        // Commit transaction
        await trx.commit()

        return response.ok({
          messages: 'UPDATE_DATA_SUCCESS',
          affected_rows: affectedRows,
        })
      } catch (error) {
        // Rollback transaction on error
        await trx.rollback()
        throw error
      }
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: this.getErrorMessage(error),
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
        error: this.getErrorMessage(error),
      })
    }
  }

  async export({ params, response }: HttpContext) {
    const activityId = params.id
    try {
      const activity = await Activity.findOrFail(activityId)
      const registrations = await ActivityRegistration.query()
        .where({ activityId: activityId })
        .preload('publicUser', (userQuery) => {
          userQuery.preload('profile', (profileQuery) => {
            profileQuery.preload('province')
            profileQuery.preload('city')
            profileQuery.preload('originProvince')
            profileQuery.preload('originCity')
            profileQuery.preload('university')
          })
        })

      if (!registrations) {
        return response.notFound({
          message: 'REGISTRATIONS_NOT_AVAILABLE',
        })
      }

      // Check if activity has a custom form attached
      const { default: CustomForm } = await import('#models/custom_form')
      const customForm = await CustomForm.query()
        .where('feature_type', 'activity_registration')
        .where('feature_id', activityId)
        .where('is_active', true)
        .first()

      let questionHeaders: string[] = []
      let questionKeys: string[] = []

      if (customForm) {
        // Use custom form schema
        const formSchema = customForm.formSchema

        // Extract all fields from all sections, excluding the profile_data section
        // since profile data is already included in baseHeaders
        for (const section of formSchema.fields) {
          // Skip the profile_data section
          if (section.section_name === 'profile_data') {
            continue
          }

          for (const field of section.fields) {
            questionHeaders.push(field.label)
            questionKeys.push(field.key)
          }
        }
      } else {
        // Use old questionnaire system
        const questions = activity.additionalConfig.additional_questionnaire
        questionHeaders = questions.map((q) => q.label)
        questionKeys = questions.map((q) => q.name)
      }

      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Registrations')

      // Add headers
      const allHeaders = [...REGISTRATION_EXPORT_HEADERS, ...questionHeaders]
      worksheet.addRow(allHeaders)

      // Style the header row
      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      }

      // Process each registration (no N+1 query - profile is preloaded)
      const locationMaps = await this.getGuestLocationMaps(registrations)
      for (const [i, item] of registrations.entries()) {
        worksheet.addRow(
          this.buildRegistrationExportRow(
            i + 1,
            item,
            questionKeys,
            activity.badge || '',
            locationMaps
          )
        )
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
      const sanitizedFileName = activity.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')

      return response
        .status(200)
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${sanitizedFileName}.xlsx"`)
        .send(buffer)
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: this.getErrorStack(error),
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
      const issuedCertificate = await IssuedCertificate.findBy('registrationId', registration.id)
      if (issuedCertificate) {
        return response.conflict({
          message: 'CERTIFICATE_REGISTRATION_HAS_ISSUED_CERTIFICATE',
        })
      }
      await ActivityRegistration.query().where('id', id).delete()
      return response.ok({
        message: 'DELETE_DATA_SUCCESS',
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: this.getErrorMessage(error),
      })
    }
  }
}
