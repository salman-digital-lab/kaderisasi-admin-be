import { test } from '@japa/runner'
import { generateCertificateCode } from '#services/certificate_code_service'

test.group('Certificate code', () => {
  test('uses 128 bits of injected cryptographic entropy', ({ assert }) => {
    const code = generateCertificateCode(42, new Date('2026-07-16T00:00:00.000Z'), () =>
      Buffer.alloc(16, 0xab)
    )

    assert.equal(code, `CERT-2026-42-${'AB'.repeat(16)}`)
    assert.match(code, /^CERT-\d{4}-\d+-[A-F0-9]{32}$/)
  })

  test('rejects invalid activity identifiers', ({ assert }) => {
    assert.throws(() => generateCertificateCode(0), 'INVALID_ACTIVITY_ID')
  })
})
