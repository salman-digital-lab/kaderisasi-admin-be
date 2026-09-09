import CertificatesController from '#controllers/certificates_controller'
import IssuedCertificate from '#models/issued_certificate'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import testUtils from '@adonisjs/core/services/test_utils'
import { ModelPaginator } from '@adonisjs/lucid/orm'
import { test } from '@japa/runner'
import { IncomingMessage } from 'node:http'
import { Socket } from 'node:net'

async function certificateContext(query: string): Promise<HttpContext> {
  const req = new IncomingMessage(new Socket())
  req.method = 'GET'
  req.url = `/v2/certificates?${query}`
  // Use the application's parser, not updateQs, which bypasses URL parsing.
  const context = await testUtils.createHttpContext({ req })
  context.requestId = 'certificate-query-test'
  return context
}

function registrationQuery(ids: number[], indexed = false): string {
  const query = new URLSearchParams({ activity_id: '193', page: '1', per_page: '100' })
  for (const [index, id] of ids.entries()) {
    query.append(indexed ? `registration_ids[${index}]` : 'registration_ids[]', String(id))
  }
  return query.toString()
}

test.group('Certificate query parsing', () => {
  for (const count of [1, 20, 21, 50, 100, 200]) {
    test(`lists certificates with ${count} bracket-encoded registration IDs`, async ({
      assert,
    }) => {
      const ids = Array.from({ length: count }, (_, index) => 15740 - index)
      const context = await certificateContext(registrationQuery(ids))
      const query = IssuedCertificate.query()
      const originalQuery = IssuedCertificate.query
      let bindings: readonly unknown[] = []
      let pagination: number[] = []
      query.paginate = async (page, perPage = 20): Promise<ModelPaginator> => {
        bindings = query.toSQL().bindings
        pagination = [page, perPage]
        return new ModelPaginator(0, perPage, page)
      }
      IssuedCertificate.query = (() => query) as typeof IssuedCertificate.query
      try {
        await new CertificatesController().index(context)
        assert.equal(context.response.getStatus(), 200)
        assert.deepEqual(bindings, [193, ...ids])
        assert.deepEqual(pagination, [1, 100])
        assert.equal(context.response.getBody().message, 'GET_DATA_SUCCESS')
        assert.deepEqual(context.response.getBody().data.data, [])
      } finally {
        IssuedCertificate.query = originalQuery
      }
    })
  }

  test('preserves all 200 indexed registration IDs', async ({ assert }) => {
    const ids = Array.from({ length: 200 }, (_, index) => index + 1)
    const context = await certificateContext(registrationQuery(ids, true))
    assert.deepEqual(context.request.qs().registration_ids, ids.map(String))
  })

  for (const query of [
    'registration_ids[]=invalid',
    'registration_ids[]=-1',
    'registration_ids[]=1.5',
    'registration_ids[unexpected]=1',
    'page=invalid',
    'per_page=101',
    registrationQuery(Array.from({ length: 201 }, (_, index) => index + 1)),
  ]) {
    const label = query.length > 100 ? '201 registration IDs' : query
    test(`returns 422 before querying certificates for ${label}`, async ({ assert }) => {
      const context = await certificateContext(query)
      const originalQuery = IssuedCertificate.query
      let queried = false
      IssuedCertificate.query = (): never => {
        queried = true
        throw new Error('Invalid filters must not query the database')
      }
      try {
        await new CertificatesController().index(context)
        assert.equal(context.response.getStatus(), 422)
        assert.equal(context.response.getBody().message, 'VALIDATION_ERROR')
        assert.isNotEmpty(context.response.getBody().errors)
        assert.isFalse(queried)
      } finally {
        IssuedCertificate.query = originalQuery
      }
    })
  }

  test('logs unexpected failures with the request ID while keeping the response generic', async ({
    assert,
  }) => {
    const context = await certificateContext('activity_id=193')
    const error = new Error('Database unavailable')
    const originalQuery = IssuedCertificate.query
    const originalLog = logger.error
    let logged: unknown
    IssuedCertificate.query = (): never => {
      throw error
    }
    logger.error = (payload: unknown): void => {
      logged = payload
    }
    try {
      await new CertificatesController().index(context)
      assert.equal(context.response.getStatus(), 500)
      assert.deepEqual(context.response.getBody(), { message: 'GENERAL_ERROR' })
      assert.deepInclude(logged, { err: error, request_id: context.requestId })
    } finally {
      IssuedCertificate.query = originalQuery
      logger.error = originalLog
    }
  })
})
