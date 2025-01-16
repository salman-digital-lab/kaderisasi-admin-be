import factory from '@adonisjs/lucid/factories'
import Activity from '#models/activity'
import { DateTime } from 'luxon'

type Questionnaire =
  | {
      id?: number
      type: 'text' | 'number'
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

const ADDITIONAL_QUESTIONNAIRE_DEFAULT = [
  {
    type: 'text',
    label:
      'Jika kamu sudah berinfaq/donasi untuk Masjid Salman ITB, silakan upload bukti transfernya di google drive, lalu taruh link-nya di sini ya!',
    name: 'question1664618698378',
    required: true,
  },
  {
    type: 'dropdown',
    label: 'Sudah menyalurkan kebaikan ini melalui apa nih?',
    name: 'question1664618817082',
    required: true,
    data: [
      {
        id: 1,
        label: 'Share poster ke 3 WA Grup',
        value: 'share poster ke 3 wa grup',
      },
      {
        id: 2,
        label: 'Mention minimal 5 akun bestienya di postingan IG',
        value: 'mention minimal 5 akun bestienya di postingan ig',
      },
      {
        id: 3,
        label: 'Ngajak sebanyak-banyak bestienya buat ikutan juga',
        value: 'ngajak sebanyak-banyak bestienya buat ikutan juga',
      },
    ],
  },
  {
    type: 'number',
    label: 'Seberapa besar motivasimu mengikuti kegiatan ini?',
    name: 'question1664619435933',
    required: true,
  },
] as Questionnaire[]

export const ActivityFactory = factory
  .define(Activity, async ({ faker }) => {
    const name = faker.lorem.sentence()
    const today = DateTime.now()

    return {
      name: name,
      slug: name.toLowerCase().replace(/ /g, '-'),
      description: `<p><span style=\"color: rgb(0, 0, 0);\">🚨 [${name}] 🚨</span></p><p class=\"ql-align-right\"><br></p><p><span style=\"color: rgb(0, 0, 0);\">Assalamualaikum para penyelaras peradaban!</span></p><p><span style=\"color: rgb(0, 0, 0);\">Siapkah kamu berkontribusi untuk membantu menyeimbangkan kehidupan??</span></p><p class=\"ql-align-right\"><br></p><p><span style=\"color: rgb(0, 0, 0);\">Keseimbangan tidak akan terjadi tanpa adanya usaha dan pengetahuan dalam setiap prosesnya. Kami membutuhkan jiwa-jiwa pemegang kunci peradaban yang senantiasa berjuang sampai titik penghabisan.</span></p><p><br></p><p><span style=\"color: rgb(0, 0, 0);\">Ayoo mari bergabung bersama kami di SSC + KK 59 Chapter Jogja. Karena kami membutuhkan kalian para kontributor pencetak generasi penyeimbang kehidupan!</span></p><p><br></p><p><span style=\"color: rgb(0, 0, 0);\">⏰ SSC KK 59 Chapter Jogja :</span></p><p><span style=\"color: rgb(0, 0, 0);\">The Day SSC 59 : 04-05 Mei 2024 (Sabtu - Minggu)</span></p><p><span style=\"color: rgb(0, 0, 0);\">The Day KK Jogja : 06-11 Mei 2024 (Senin - Sabtu)</span></p><p><br></p><p><span style=\"color: rgb(0, 0, 0);\">👇🏻👇🏻Link pendaftaran👇🏻👇🏻</span></p><p><span style=\"color: rgb(0, 0, 0);\">https://bit.ly/DaftarPanitiaSSCKK59</span></p><p><span style=\"color: rgb(0, 0, 0);\">https://bit.ly/DaftarPanitiaSSCKK59</span></p><p><span style=\"color: rgb(0, 0, 0);\">https://bit.ly/DaftarPanitiaSSCKK59</span></p><p><br></p><p><span style=\"color: rgb(0, 0, 0);\">Pendaftaran panitia hanya sampai 24 Maret 2024. Jadi, jangan sampai kelewatan yaa!</span></p><p><br></p><p><span style=\"color: rgb(0, 0, 0);\">☎ Narahubung ☎</span></p><p><span style=\"color: rgb(0, 0, 0);\">WA : 0895345077686</span></p><p><span style=\"color: rgb(0, 0, 0);\">nanya2: https://bit.ly/QnAPanitSSCKK59</span></p>`,
      activity_start: today.plus({ days: 7 }),
      activity_end: today.plus({ days: 10 }),
      registration_start: today,
      registration_end: today.plus({ days: 6 }),
      selection_start: today,
      selection_end: today.plus({ days: 6 }),
      minimum_level: faker.number.int({ min: 0, max: 6 }),
      activity_type: faker.number.int({ min: 0, max: 7 }),
      activity_category: faker.number.int({ min: 0, max: 5 }),
      is_published: 1,
      additionalConfig: {
        images: [],
        custom_selection_status: ['Tahap 1', 'Tahap 2', 'Tahap 3'],
        mandatory_profile_data: [],
        additional_questionnaire: ADDITIONAL_QUESTIONNAIRE_DEFAULT,
      },
    }
  })
  .build()

export const FinishedActivityFactory = factory
  .define(Activity, async ({ faker }) => {
    const name = faker.lorem.sentence()
    const today = DateTime.now()

    return {
      name: name,
      slug: name.toLowerCase().replace(/ /g, '-'),
      description: `<p><span style=\"color: rgb(0, 0, 0);\">🚨 [${name}] 🚨</span></p><p class=\"ql-align-right\"><br></p><p><span style=\"color: rgb(0, 0, 0);\">Assalamualaikum para penyelaras peradaban!</span></p><p><span style=\"color: rgb(0, 0, 0);\">Siapkah kamu berkontribusi untuk membantu menyeimbangkan kehidupan??</span></p><p class=\"ql-align-right\"><br></p><p><span style=\"color: rgb(0, 0, 0);\">Keseimbangan tidak akan terjadi tanpa adanya usaha dan pengetahuan dalam setiap prosesnya. Kami membutuhkan jiwa-jiwa pemegang kunci peradaban yang senantiasa berjuang sampai titik penghabisan.</span></p><p><br></p><p><span style=\"color: rgb(0, 0, 0);\">Ayoo mari bergabung bersama kami di SSC + KK 59 Chapter Jogja. Karena kami membutuhkan kalian para kontributor pencetak generasi penyeimbang kehidupan!</span></p><p><br></p><p><span style=\"color: rgb(0, 0, 0);\">⏰ SSC KK 59 Chapter Jogja :</span></p><p><span style=\"color: rgb(0, 0, 0);\">The Day SSC 59 : 04-05 Mei 2024 (Sabtu - Minggu)</span></p><p><span style=\"color: rgb(0, 0, 0);\">The Day KK Jogja : 06-11 Mei 2024 (Senin - Sabtu)</span></p><p><br></p><p><span style=\"color: rgb(0, 0, 0);\">👇🏻👇🏻Link pendaftaran👇🏻👇🏻</span></p><p><span style=\"color: rgb(0, 0, 0);\">https://bit.ly/DaftarPanitiaSSCKK59</span></p><p><span style=\"color: rgb(0, 0, 0);\">https://bit.ly/DaftarPanitiaSSCKK59</span></p><p><span style=\"color: rgb(0, 0, 0);\">https://bit.ly/DaftarPanitiaSSCKK59</span></p><p><br></p><p><span style=\"color: rgb(0, 0, 0);\">Pendaftaran panitia hanya sampai 24 Maret 2024. Jadi, jangan sampai kelewatan yaa!</span></p><p><br></p><p><span style=\"color: rgb(0, 0, 0);\">☎ Narahubung ☎</span></p><p><span style=\"color: rgb(0, 0, 0);\">WA : 0895345077686</span></p><p><span style=\"color: rgb(0, 0, 0);\">nanya2: https://bit.ly/QnAPanitSSCKK59</span></p>`,
      activity_start: today.plus({ days: 7 }),
      activity_end: today.plus({ days: 10 }),
      registration_start: today.minus({ days: 10 }),
      registration_end: today.minus({ days: 4 }),
      selection_start: today.minus({ days: 10 }),
      selection_end: today.minus({ days: 4 }),
      minimum_level: faker.number.int({ min: 0, max: 6 }),
      activity_type: faker.number.int({ min: 0, max: 7 }),
      activity_category: faker.number.int({ min: 0, max: 5 }),
      is_published: 0,
      additionalConfig: {
        custom_selection_status: ['Tahap 1', 'Tahap 2', 'Tahap 3'],
        mandatory_profile_data: [],
        additional_questionnaire: ADDITIONAL_QUESTIONNAIRE_DEFAULT,
        images: [],
      },
    }
  })
  .build()
