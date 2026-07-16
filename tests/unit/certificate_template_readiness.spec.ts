import { test } from '@japa/runner'
import {
  getCertificateTemplateReadiness,
  lifecycleData,
} from '#services/certificate_template_readiness_service'
import type { TemplateData } from '#models/certificate_template'

function validTemplateData(): TemplateData {
  return {
    backgroundUrl: null,
    canvasWidth: 800,
    canvasHeight: 566,
    elements: [
      {
        id: 'participant-name',
        type: 'variable-text',
        variable: '{{name}}',
        x: 100,
        y: 100,
        width: 600,
        height: 80,
      },
    ],
  }
}

test.group('Certificate template readiness', () => {
  test('allows a ready plain-canvas template', ({ assert }) => {
    const readiness = getCertificateTemplateReadiness({
      id: 10,
      name: 'Certificate',
      backgroundImage: null,
      templateData: validTemplateData(),
    })

    assert.deepEqual(readiness, { ready: true, errors: [] })
  })

  test('rejects public PII variables and unmanaged assets', ({ assert }) => {
    const data = validTemplateData()
    data.elements.push(
      {
        id: 'email',
        type: 'variable-text',
        variable: '{{email}}',
        x: 100,
        y: 200,
        width: 300,
        height: 50,
      },
      {
        id: 'signature',
        type: 'signature',
        imageUrl: 'data:image/png;base64,abc',
        x: 300,
        y: 300,
        width: 100,
        height: 100,
      }
    )

    const readiness = getCertificateTemplateReadiness({
      id: 10,
      name: 'Certificate',
      backgroundImage: null,
      templateData: data,
    })

    assert.isFalse(readiness.ready)
    assert.includeMembers(readiness.errors, [
      'UNSUPPORTED_VARIABLE',
      'ELEMENT_MUST_USE_MANAGED_ASSET',
    ])
  })

  test('does not count hidden participant-name elements as publishable', ({ assert }) => {
    const data = validTemplateData()
    data.elements[0].visible = false

    const readiness = getCertificateTemplateReadiness({
      id: 10,
      name: 'Certificate',
      backgroundImage: null,
      templateData: data,
    })

    assert.include(readiness.errors, 'PARTICIPANT_NAME_VARIABLE_REQUIRED')
  })

  test('serializes lifecycle status for the API contract', ({ assert }) => {
    assert.deepEqual(lifecycleData({ lifecycleStatus: 'draft', version: 2 }), {
      status: 'draft',
      is_active: false,
      version: 2,
      published_at: null,
      archived_at: null,
    })
  })
})
