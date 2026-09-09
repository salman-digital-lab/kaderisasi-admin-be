import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Club from '#models/club'
import ClubRegistration from '#models/club_registration'
import Controller from '#controllers/club_registrations_controller'
import ExcelJS from 'exceljs'
import { randomUUID } from 'node:crypto'

test.group('Admin Club registration workflow', (group) => {
  group.each.setup(async () => {
    if (process.env.CLUB_REGISTRATION_INTEGRATION !== '1') return async () => {}
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })
  test('preserves answers during review, validates bulk changes and exports legacy rows', async ({
    assert,
  }) => {
    const club = await Club.create({ name: `QA ${randomUUID()}` })
    const [user] = await db
      .table('public_users')
      .insert({
        email: `${randomUUID()}@example.test`,
        password: 'fixture-only',
        created_at: new Date(),
      })
      .returning('id')
    await db.table('profiles').insert({ user_id: user.id, name: 'QA Applicant' })
    const controller = new Controller()
    async function context(id: number, body: Record<string, unknown> = {}) {
      const ctx = await testUtils.createHttpContext()
      ctx.params = { id: String(id) }
      ctx.request.updateBody(body)
      return ctx
    }
    const create = await context(club.id, {
      member_id: user.id,
      additional_data: { experience: 0, consent: false },
    })
    await controller.store(create)
    assert.equal(create.response.getStatus(), 200)
    const duplicate = await context(club.id, { member_id: user.id })
    await controller.store(duplicate)
    assert.equal(duplicate.response.getStatus(), 409)
    const registration = await ClubRegistration.findByOrFail('clubId', club.id)
    const update = await context(registration.id, { status: 'APPROVED' })
    await controller.update(update)
    assert.equal(update.response.getStatus(), 200)
    await registration.refresh()
    assert.deepEqual(registration.additionalData, { experience: 0, consent: false })
    const bulk = await context(club.id, {
      registrations: [
        { id: registration.id, status: 'REJECTED' },
        { id: 2147483647, status: 'APPROVED' },
      ],
    })
    await controller.bulkUpdate(bulk)
    assert.equal(bulk.response.getStatus(), 404)
    await registration.refresh()
    assert.equal(registration.status, 'APPROVED')
    const duplicateBulk = await context(club.id, {
      registrations: [
        { id: registration.id, status: 'REJECTED' },
        { id: registration.id, status: 'APPROVED' },
      ],
    })
    await controller.bulkUpdate(duplicateBulk)
    assert.equal(duplicateBulk.response.getStatus(), 400)
    const exported = await context(club.id)
    await controller.export(exported)
    assert.equal(exported.response.getStatus(), 200)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(exported.response.getBody())
    const row = workbook.worksheets[0].getRow(2)
    const headers = workbook.worksheets[0].getRow(1).values as string[]
    assert.equal(row.getCell(headers.indexOf('Experience')).value, 0)
    assert.equal(row.getCell(headers.indexOf('Consent')).value, 'Tidak')
    await db.from('club_registrations').where('id', registration.id).update({ created_at: null })
    const legacy = await context(club.id)
    await controller.export(legacy)
    assert.equal(legacy.response.getStatus(), 200, JSON.stringify(legacy.response.getBody()))
  })
    .skip(process.env.CLUB_REGISTRATION_INTEGRATION !== '1')
    .timeout(30000)
})
