import CertificatesController from '#controllers/certificates_controller'
import IssuedCertificate from '#models/issued_certificate'
import type { HttpContext } from '@adonisjs/core/http'
import testUtils from '@adonisjs/core/services/test_utils'
import { ModelPaginator } from '@adonisjs/lucid/orm'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

async function lookupContext(body: Record<string, unknown>): Promise<HttpContext> {
  const context = await testUtils.createHttpContext()
  context.request.request.method = 'POST'
  context.request.request.url = '/v2/certificates/lookup'
  context.request.allFiles = () => ({})
  context.request.updateBody(body)
  return context
}

function certificate(registrationId: number): IssuedCertificate {
  const issued = new IssuedCertificate()
  issued.id = registrationId
  issued.registrationId = registrationId
  issued.activityId = 193
  issued.certificateCode = `CERT-TEST-${registrationId}`
  issued.issuedAt = DateTime.fromISO('2026-09-09T10:00:00Z')
  issued.revokedAt = null
  issued.participantSnapshot = {
    registration_id: registrationId,
    user_id: null,
    name: `Participant ${registrationId}`,
    email: '',
    university: '',
    gender: '',
    activity_name: 'Test activity',
    activity_date: '',
  }
  return issued
}

test.group('Certificate JSON lookup', () => {
  for (const count of [1, 50, 100]) {
    test(`returns all ${count} matching summaries without pagination metadata`, async ({
      assert,
    }) => {
      const ids = Array.from({ length: count }, (_, index) => 15740 - index)
      const context = await lookupContext({ activity_id: 193, registration_ids: ids })
      const query = IssuedCertificate.query()
      const originalQuery = IssuedCertificate.query
      let bindings: readonly unknown[] = []
      let pagination: number[] = []
      query.paginate = async (page, perPage = 20): Promise<ModelPaginator> => {
        bindings = query.toSQL().bindings
        pagination = [page, perPage]
        return new ModelPaginator(count, perPage, page, ...ids.map(certificate))
      }
      IssuedCertificate.query = (() => query) as typeof IssuedCertificate.query
      try {
        await new CertificatesController().lookup(context)
        assert.equal(context.response.getStatus(), 200)
        assert.deepEqual(bindings, [193, ...ids])
        assert.deepEqual(pagination, [1, count])
        const body = context.response.getBody()
        assert.lengthOf(body.data, count)
        assert.equal(body.data[0].registration_id, ids[0])
        assert.equal(body.data[count - 1].registration_id, ids[count - 1])
        assert.equal(body.data[0].state, 'issued_active')
        assert.notProperty(body, 'meta')
        assert.notProperty(body.data[0], 'participant_snapshot')
      } finally {
        IssuedCertificate.query = originalQuery
      }
    })
  }

  test('deduplicates IDs and returns an empty array when none match', async ({ assert }) => {
    const context = await lookupContext({ registration_ids: [15740, 15740, 15739] })
    const query = IssuedCertificate.query()
    const originalQuery = IssuedCertificate.query
    let bindings: readonly unknown[] = []
    query.paginate = async (page, perPage = 20): Promise<ModelPaginator> => {
      bindings = query.toSQL().bindings
      return new ModelPaginator(0, perPage, page)
    }
    IssuedCertificate.query = (() => query) as typeof IssuedCertificate.query
    try {
      await new CertificatesController().lookup(context)
      assert.equal(context.response.getStatus(), 200)
      assert.deepEqual(bindings, [15740, 15739])
      assert.deepEqual(context.response.getBody(), { message: 'GET_DATA_SUCCESS', data: [] })
    } finally {
      IssuedCertificate.query = originalQuery
    }
  })

  const invalidBodies: Record<string, unknown>[] = [
    {},
    { registration_ids: [] },
    { registration_ids: '15740,15739' },
    { registration_ids: { 0: 15740 } },
    { registration_ids: [0] },
    { registration_ids: [1.5] },
    { registration_ids: [Number.MAX_SAFE_INTEGER + 1] },
    { registration_ids: [15740], activity_id: 0 },
    { registration_ids: Array.from({ length: 101 }, (_, index) => index + 1) },
  ]
  for (const [index, body] of invalidBodies.entries()) {
    test(`rejects malformed or oversized lookup payload ${index + 1} before querying`, async ({
      assert,
    }) => {
      const context = await lookupContext(body)
      const originalQuery = IssuedCertificate.query
      let queried = false
      IssuedCertificate.query = (): never => {
        queried = true
        throw new Error('Invalid lookup must not query the database')
      }
      try {
        await new CertificatesController().lookup(context)
        assert.equal(context.response.getStatus(), 422)
        assert.equal(context.response.getBody().message, 'VALIDATION_ERROR')
        assert.isFalse(queried)
      } finally {
        IssuedCertificate.query = originalQuery
      }
    })
  }
})
