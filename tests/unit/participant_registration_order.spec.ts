import ActivityRegistrationsController from '#controllers/activity_registrations_controller'
import ClubRegistrationsController from '#controllers/club_registrations_controller'
import CertificatesController from '#controllers/certificates_controller'
import Activity from '#models/activity'
import Club from '#models/club'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'

type ParticipantList = 'activity' | 'club registrations' | 'club members' | 'certificates'
interface RegistrationRow {
  id?: number
  registration_id?: number
  created_at: string | null
}
interface ParticipantPage {
  meta: { total: number }
  data: RegistrationRow[]
}

async function loadPage(
  list: ParticipantList,
  id: number,
  options: Record<string, string | number> = {}
): Promise<ParticipantPage> {
  const context = await testUtils.createHttpContext()
  context.params = { id: String(id), activityId: String(id) }
  context.request.updateQs({ page: 1, per_page: 2, limit: 2, ...options })
  switch (list) {
    case 'activity':
      await new ActivityRegistrationsController().index(context)
      break
    case 'club registrations':
      await new ClubRegistrationsController().index(context)
      break
    case 'club members':
      await new ClubRegistrationsController().members(context)
      break
    case 'certificates':
      await new CertificatesController().recipients(context)
      break
  }
  if (context.response.getStatus() !== 200) {
    throw new Error(JSON.stringify(context.response.getBody()))
  }
  // Exercise the same paginator/date serialization consumed by the frontend.
  const body = JSON.parse(JSON.stringify(context.response.getBody())) as { data: ParticipantPage }
  return body.data
}

async function fixture(list: ParticipantList): Promise<{ id: number; ids: number[] }> {
  const latest = '2026-09-09T09:30:45.000Z'
  const oldest = '2026-09-08T09:30:44.000Z'
  const timestamps = [latest, oldest, latest, null]
  const isClub = list === 'club registrations' || list === 'club members'
  const entity = isClub
    ? await Club.create({ name: 'Registration order fixture' })
    : await Activity.create({
        name: 'Registration order fixture',
        slug: randomUUID(),
        additionalConfig: {
          mandatory_profile_data: [],
          custom_selection_status: [],
          additional_questionnaire: [],
          images: [],
        },
      })
  const ids: number[] = []
  for (const [index, timestamp] of timestamps.entries()) {
    const [user] = (await db
      .table('public_users')
      .insert({
        email: `${randomUUID()}@example.test`,
        password: 'fixture-only',
        created_at: new Date(oldest),
      })
      .returning('id')) as Array<{ id: number }>
    await db.table('profiles').insert({ user_id: user.id, name: `Person ${index}` })
    const [registration] = (await db
      .table(isClub ? 'club_registrations' : 'activity_registrations')
      .insert({
        ...(isClub
          ? { club_id: entity.id, member_id: user.id, status: 'APPROVED' }
          : {
              activity_id: entity.id,
              user_id: index % 2 === 0 ? user.id : null,
              guest_data: JSON.stringify({ name: `Guest ${index}` }),
              status: 'LULUS KEGIATAN',
            }),
        created_at: timestamp ? new Date(timestamp) : null,
        // Registration time must be independent of subsequent status updates.
        updated_at: index === 1 ? latest : oldest,
      })
      .returning('id')) as Array<{ id: number }>
    ids.push(registration.id)
  }
  return { id: entity.id, ids }
}

// Opt in only against a disposable localhost database, never the configured shared database.
test.group('Participant registration ordering', (group) => {
  group.each.setup(async () => {
    if (process.env.PARTICIPANT_INTEGRATION !== '1') return async () => {}
    if (!['127.0.0.1', 'localhost'].includes(process.env.DB_HOST ?? '')) {
      throw new Error('Disposable localhost database required')
    }
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  const lists: ParticipantList[] = [
    'activity',
    'club registrations',
    'club members',
    'certificates',
  ]
  for (const list of lists) {
    test(`${list}: sorts timestamps before pagination, with stable ties and missing dates last`, async ({
      assert,
    }) => {
      const { id, ids } = await fixture(list)
      const rowIds = (page: ParticipantPage): Array<number | undefined> =>
        page.data.map((row) => row.registration_id ?? row.id)
      const newest = await loadPage(list, id)
      assert.deepEqual(rowIds(newest), [ids[2], ids[0]])
      assert.equal(Number(newest.meta.total), 4)
      assert.equal(new Date(newest.data[0].created_at!).toISOString(), '2026-09-09T09:30:45.000Z')

      const nextNewest = await loadPage(list, id, { page: 2 })
      assert.deepEqual(rowIds(nextNewest), [ids[1], ids[3]])
      assert.isNull(nextNewest.data[1].created_at)

      const oldest = await loadPage(list, id, { sort_order: 'asc' })
      assert.deepEqual(rowIds(oldest), [ids[1], ids[0]])
      const nextOldest = await loadPage(list, id, { page: 2, sort_order: 'asc' })
      assert.deepEqual(rowIds(nextOldest), [ids[2], ids[3]])

      const filtered = await loadPage(list, id, {
        sort_order: 'asc',
        ...(list === 'certificates'
          ? { state: 'eligible_not_issued' }
          : { status: list === 'activity' ? 'LULUS KEGIATAN' : 'APPROVED' }),
      })
      assert.deepEqual(rowIds(filtered), [ids[1], ids[0]])
    }).skip(process.env.PARTICIPANT_INTEGRATION !== '1')
  }
})
