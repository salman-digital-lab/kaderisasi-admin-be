import { test } from '@japa/runner'
import {
  matchesCertificateTemplateVersion,
  nextCertificateTemplateVersion,
} from '#services/certificate_template_version_service'

test.group('Certificate template optimistic versioning', () => {
  test('accepts the current expected version', ({ assert }) => {
    assert.isTrue(matchesCertificateTemplateVersion(4, 4))
  })

  test('rejects stale expected versions without advancing them', ({ assert }) => {
    const currentVersion = 5
    assert.isFalse(matchesCertificateTemplateVersion(currentVersion, 4))
    assert.equal(currentVersion, 5)
  })

  test('increments exactly once for each accepted mutation', ({ assert }) => {
    assert.equal(nextCertificateTemplateVersion(7), 8)
  })

  test('only one competing mutation can retain the original expectation', ({ assert }) => {
    const originalVersion = 10
    const firstVersion = nextCertificateTemplateVersion(originalVersion)

    assert.isTrue(matchesCertificateTemplateVersion(originalVersion, 10))
    assert.isFalse(matchesCertificateTemplateVersion(firstVersion, 10))
    assert.isTrue(matchesCertificateTemplateVersion(firstVersion, 11))
  })
})
