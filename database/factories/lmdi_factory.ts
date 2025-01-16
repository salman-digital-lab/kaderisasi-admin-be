import factory from '@adonisjs/lucid/factories'
import Activity from '#models/activity'
import { DateTime } from 'luxon'

export enum ACTIVITY_TYPE_ENUM {
  COMMON,
  REGISTRATION_ONLY,
  SSC,
  KK,
  LMD,
  INVENTRA,
  KOMPROF,
  SPECTRA,
  SUB_PROGRAM,
}

export enum ACTIVITY_CATEGORY_ENUM {
  PELATIHAN,
  KEASRAMAAN,
  KADERISASI,
  AKTUALISASI_DIRI,
  KEALUMNIAN,
}

type PersonalQuestionnaire = {
  name: string
  required: boolean
}

type Questionnaire =
  | {
      id?: number
      type: 'text' | 'number' | 'textarea'
      label: string
      name: string
      required: boolean
    }
  | {
      id?: number
      type: 'dropdown'
      label: string
      name: string
      required: boolean
      data: { label: string; value: string; id: number }[]
    }

const PERSONAL_QUESTIONNAIRE_DEFAULT = [
  { name: 'personal_id', required: true },
  { name: 'gender', required: true },
  { name: 'province_id', required: true },
  { name: 'whatsapp', required: true },
  { name: 'linkedin', required: true },
  { name: 'tiktok', required: false },
  { name: 'university_temp', required: true },
  { name: 'major', required: true },
  { name: 'intake_year', required: true },
] as PersonalQuestionnaire[]

const ADDITIONAL_QUESTIONNAIRE_DEFAULT = [
  {
    type: 'textarea',
    label: 'What is your motivation for joining this event?',
    name: 'question1664618698378',
    required: true,
  },
  {
    type: 'dropdown',
    label: 'Where did you hear about this event?',
    name: 'question1664618817082',
    required: true,
    data: [
      {
        id: 1,
        label: 'Instagram @interleadershipsummit',
        value: 'Instagram @interleadershipsummit',
      },
      {
        id: 2,
        label: 'ILiAS Brand Ambassador',
        value: 'ILiAS Brand Ambassador',
      },
      {
        id: 3,
        label: 'Broadcast Message',
        value: 'Broadcast Message',
      },
      {
        id: 3,
        label: 'Media Partner Instagram',
        value: 'Media Partner Instagram',
      },
      {
        id: 3,
        label: 'Friend / Colleague',
        value: 'Friend / Colleague',
      },
    ],
  },
  {
    type: 'text',
    label: 'Link to your curriculum vitae',
    name: 'question162434618698378',
    required: true,
  },
  {
    type: 'text',
    label: 'Link copy of the last transcript',
    name: 'question1624346186343378',
    required: true,
  },
  {
    type: 'text',
    label: 'Enter your referral code',
    name: 'question16646132498378',
    required: true,
  },
] as Questionnaire[]

export const LMDIActivityRegistration = factory
  .define(Activity, async () => {
    return {
      name: 'Call For Participants',
      slug: 'call-for-participants',
      registration_start: DateTime.local(2024, 4, 12),
      registration_end: DateTime.local(2024, 5, 31),
      activity_type: ACTIVITY_TYPE_ENUM.REGISTRATION_ONLY,
      activityCategory: ACTIVITY_CATEGORY_ENUM.KADERISASI,
      description: `<p><span style=\"color: rgb(0, 0, 0);\">🚨 [LMDI TEST ONLY] 🚨</span></p><p class=\"ql-align-right\"><br></p><p><span style=\"color: rgb(0, 0, 0);\">Assalamualaikum para penyelaras peradaban!</span></p><p><span style=\"color: rgb(0, 0, 0);\">Siapkah kamu berkontribusi untuk membantu menyeimbangkan kehidupan??</span></p><p class=\"ql-align-right\"><br></p><p><span style=\"color: rgb(0, 0, 0);\">Keseimbangan tidak akan terjadi tanpa adanya usaha dan pengetahuan dalam setiap prosesnya. Kami membutuhkan jiwa-jiwa pemegang kunci peradaban yang senantiasa berjuang sampai titik penghabisan.</span></p><p><br></p><p><span style=\"color: rgb(0, 0, 0);\">Ayoo mari bergabung bersama kami di SSC + KK 59 Chapter Jogja. Karena kami membutuhkan kalian para kontributor pencetak generasi penyeimbang kehidupan!</span></p><p><br></p><p><span style=\"color: rgb(0, 0, 0);\">⏰ SSC KK 59 Chapter Jogja :</span></p><p><span style=\"color: rgb(0, 0, 0);\">The Day SSC 59 : 04-05 Mei 2024 (Sabtu - Minggu)</span></p><p><span style=\"color: rgb(0, 0, 0);\">The Day KK Jogja : 06-11 Mei 2024 (Senin - Sabtu)</span></p><p><br></p><p><span style=\"color: rgb(0, 0, 0);\">👇🏻👇🏻Link pendaftaran👇🏻👇🏻</span></p><p><span style=\"color: rgb(0, 0, 0);\">https://bit.ly/DaftarPanitiaSSCKK59</span></p><p><span style=\"color: rgb(0, 0, 0);\">https://bit.ly/DaftarPanitiaSSCKK59</span></p><p><span style=\"color: rgb(0, 0, 0);\">https://bit.ly/DaftarPanitiaSSCKK59</span></p><p><br></p><p><span style=\"color: rgb(0, 0, 0);\">Pendaftaran panitia hanya sampai 24 Maret 2024. Jadi, jangan sampai kelewatan yaa!</span></p><p><br></p><p><span style=\"color: rgb(0, 0, 0);\">☎ Narahubung ☎</span></p><p><span style=\"color: rgb(0, 0, 0);\">WA : 0895345077686</span></p><p><span style=\"color: rgb(0, 0, 0);\">nanya2: https://bit.ly/QnAPanitSSCKK59</span></p>`,

      is_published: 1,
      additionalConfig: {
        images: [],
        custom_selection_status: [],
        mandatory_profile_data: PERSONAL_QUESTIONNAIRE_DEFAULT,
        additional_questionnaire: ADDITIONAL_QUESTIONNAIRE_DEFAULT,
      },
    }
  })
  .build()

export const LMDIActivityFirstTraining = factory
  .define(Activity, async () => {
    return {
      name: 'Youth Productive Class',
      slug: 'youth-produvtive-class',
      activityCategory: ACTIVITY_CATEGORY_ENUM.KADERISASI,

      registration_start: DateTime.local(2024, 6, 7),
      registration_end: DateTime.local(2024, 6, 9),
      activity_type: ACTIVITY_TYPE_ENUM.SUB_PROGRAM,
      is_published: 1,
    }
  })
  .build()

export const LMDIActivitySecondSelection = factory
  .define(Activity, async () => {
    return {
      name: '2nd Phase Selection',
      slug: '2nd-phase-selection',
      activityCategory: ACTIVITY_CATEGORY_ENUM.KADERISASI,

      registration_start: DateTime.local(2024, 6, 13),
      registration_end: DateTime.local(2024, 7, 4),
      activity_type: ACTIVITY_TYPE_ENUM.SUB_PROGRAM,
      is_published: 1,
    }
  })
  .build()

export const LMDIActivityPersonalityAssesment = factory
  .define(Activity, async () => {
    return {
      name: 'Personality Assessment',
      slug: 'personality-assessment',
      activityCategory: ACTIVITY_CATEGORY_ENUM.KADERISASI,

      registration_start: DateTime.local(2024, 7, 8),
      registration_end: DateTime.local(2024, 7, 14),
      activity_type: ACTIVITY_TYPE_ENUM.SUB_PROGRAM,
      is_published: 1,
    }
  })
  .build()

export const LMDIActivityInnovatorClass = factory
  .define(Activity, async () => {
    return {
      name: 'Innovator Class & Mentorship',
      slug: 'innovator-class-mentorship',
      activityCategory: ACTIVITY_CATEGORY_ENUM.KADERISASI,

      registration_start: DateTime.local(2024, 7, 15),
      registration_end: DateTime.local(2024, 8, 17),
      activity_type: ACTIVITY_TYPE_ENUM.SUB_PROGRAM,
      is_published: 1,
    }
  })
  .build()

export const LMDIActivityMain = factory
  .define(Activity, async () => {
    return {
      name: 'Leadership in Action Summit 2024',
      slug: 'leadership-in-action-summit-2024',
      activityCategory: ACTIVITY_CATEGORY_ENUM.KADERISASI,
      registration_start: DateTime.local(2024, 8, 20),
      registration_end: DateTime.local(2024, 8, 25),
      activity_type: ACTIVITY_TYPE_ENUM.SUB_PROGRAM,
      is_published: 1,
    }
  })
  .build()
