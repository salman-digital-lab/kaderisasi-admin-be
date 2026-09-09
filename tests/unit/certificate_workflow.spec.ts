import Activity from '#models/activity'
import ActivityRegistration from '#models/activity_registration'
import CertificateTemplate, { type TemplateData } from '#models/certificate_template'
import IssuedCertificate from '#models/issued_certificate'
import CertificateTemplatesController from '#controllers/certificate_templates_controller'
import CertificatesController from '#controllers/certificates_controller'
import ActivitiesController from '#controllers/activities_controller'
import {
  duplicateCertificateTemplate,
  getTemplateAssetKey,
} from '#services/certificate_template_copy_service'
import {
  issueBulkCertificates,
  issueSingleCertificate,
  listIssuedCertificates,
} from '#services/certificate_service'
import {
  getCertificateRecipients,
  prepareCertificateIssuance,
} from '#services/certificate_workflow_service'
import testUtils from '@adonisjs/core/services/test_utils'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { randomUUID } from 'node:crypto'

async function certificateContext() {
  const context = await testUtils.createHttpContext()
  // Unit controller calls do not pass through the HTTP bodyparser middleware.
  context.request.allFiles = () => ({})
  const auth = await context.containerResolver.make('auth.manager')
  context.auth = auth.createAuthenticator(context)
  return context
}

const design = (): TemplateData => ({
  backgroundUrl: null,
  canvasWidth: 800,
  canvasHeight: 566,
  elements: [
    {
      id: 'name',
      type: 'variable-text',
      variable: '{{name}}',
      x: 40,
      y: 100,
      width: 720,
      height: 100,
    },
  ],
})

async function fixture(count: number) {
  const template = await CertificateTemplate.create({
    name: 'Fixture',
    templateData: design(),
    lifecycleStatus: 'published',
    version: 1,
    isActive: true,
    backgroundAssetVersion: 0,
  })
  const activity = await Activity.create({
    name: 'Fixture activity',
    slug: randomUUID(),
    certificateTemplateId: template.id,
  })
  const rows = count
    ? await db
        .table('activity_registrations')
        .multiInsert(
          Array.from({ length: count }, (_, i) => ({
            activity_id: activity.id,
            status: 'LULUS KEGIATAN',
            guest_data: JSON.stringify({ name: `Peserta ${i + 1}` }),
          }))
        )
        .returning('id')
    : []
  const ids = rows.map((row: { id: number }) => row.id)
  return {
    template,
    activity,
    ids,
    expected: {
      activity_id: activity.id,
      template_id: template.id,
      template_version: template.version,
    },
  }
}

test.group('Certificate managed asset keys', () => {
  test('resolves managed keys without requesting the source URL', ({ assert }) => {
    assert.equal(
      getTemplateAssetKey('https://storage.test/bucket/certificate/templates/12/assets/a.png', 12),
      'certificate/templates/12/assets/a.png'
    )
    assert.equal(
      getTemplateAssetKey('certificate/templates/12/assets/a.png', 12),
      'certificate/templates/12/assets/a.png'
    )
  })
  test('rejects other namespaces and traversal', ({ assert }) => {
    for (const value of [
      'certificate/templates/13/a.png',
      'evilcertificate/templates/12/a.png',
      'certificate/templates/12/../a.png',
      'data:image/png,abc',
    ]) {
      assert.throws(() => getTemplateAssetKey(value, 12), 'INVALID_CERTIFICATE_ASSET_KEY')
    }
  })
})

// Explicit opt-in prevents tests from mutating a configured shared database.
// Run against a disposable localhost database after `node ace migration:run`.
test.group('Certificate workflow integration', (group) => {
  group.each.setup(async () => {
    if (process.env.CERTIFICATE_INTEGRATION !== '1') return async () => {}
    if (!['127.0.0.1', 'localhost'].includes(process.env.DB_HOST ?? ''))
      throw new Error('Disposable localhost database required')
    await db.beginGlobalTransaction()
    drive.fake()
    return async () => {
      drive.restore()
      await db.rollbackGlobalTransaction()
    }
  })

  test('paginates summaries and freezes activity-wide recipients independently of search', async ({
    assert,
  }) => {
    const { activity, ids } = await fixture(101)
    const [user] = await db
      .table('public_users')
      .insert({
        email: `${randomUUID()}@example.test`,
        password: 'fixture-only',
        created_at: new Date(),
      })
      .returning('id')
    await ActivityRegistration.query().where('id', ids[0]).update({ userId: user.id })
    await db.table('profiles').multiInsert([
      { user_id: user.id, name: 'Peserta 1' },
      { user_id: user.id, name: 'Legacy duplicate profile' },
    ])
    const page = await getCertificateRecipients(activity.id, { page: 2, perPage: 50 })
    assert.lengthOf(page.data, 50)
    assert.equal(Number(page.meta.total), 101)
    assert.equal(page.counts.eligible_not_issued, 101)
    assert.notProperty(page.data[0], 'template_snapshot')
    const filtered = await getCertificateRecipients(activity.id, {
      page: 1,
      perPage: 50,
      search: 'Peserta 101',
    })
    assert.lengthOf(filtered.data, 1)
    assert.equal(filtered.counts.eligible_not_issued, 101)
    const all = await prepareCertificateIssuance(activity.id)
    assert.isTrue(all.success)
    if (all.success) assert.deepEqual(all.data.registration_ids, ids)
    const selected = await prepareCertificateIssuance(activity.id, [ids[0], ids[100]])
    assert.isTrue(selected.success)
    if (selected.success) assert.deepEqual(selected.data.registration_ids, [ids[0], ids[100]])
  }).skip(process.env.CERTIFICATE_INTEGRATION !== '1')

  test('issues 1000 recipients, excludes existing/revoked/ineligible, and retries without duplicates', async ({
    assert,
  }) => {
    const { activity, ids, expected } = await fixture(1000)
    const empty = await fixture(0)
    const emptyReview = await prepareCertificateIssuance(empty.activity.id)
    assert.isTrue(emptyReview.success)
    if (emptyReview.success) assert.deepEqual(emptyReview.data.registration_ids, [])
    for (let i = 0; i < ids.length; i += 100) {
      const result = await issueBulkCertificates(ids.slice(i, i + 100), null, undefined, expected)
      assert.equal(result.total_created, 100)
    }
    const retry = await issueBulkCertificates([ids[0], ids[0], ids[999]], null, undefined, expected)
    assert.equal(retry.total_created, 0)
    assert.equal(retry.total_already_issued, 2)
    const first = await IssuedCertificate.findByOrFail('registrationId', ids[0])
    await first.merge({ revokedAt: DateTime.now(), revokedReason: 'Fixture revoked' }).save()
    await ActivityRegistration.query().where('id', ids[1]).update({ status: 'BELUM LULUS' })
    const review = await prepareCertificateIssuance(activity.id)
    assert.isTrue(review.success)
    if (review.success) {
      assert.lengthOf(review.data.registration_ids, 0)
      assert.equal(review.data.excluded.revoked, 1)
      assert.equal(review.data.excluded.already_issued, 999)
    }
    const count = await IssuedCertificate.query()
      .where('activityId', activity.id)
      .count('* as total')
    assert.equal(Number(count[0].$extras.total), 1000)
  })
    .timeout(120_000)
    .skip(process.env.CERTIFICATE_INTEGRATION !== '1')

  test('revalidates assignment, version and eligibility while preserving prior results and snapshots', async ({
    assert,
  }) => {
    const { activity, template, ids, expected } = await fixture(3)
    const issued = await issueSingleCertificate(ids[0], null, undefined, expected)
    assert.isTrue(issued.success)
    await ActivityRegistration.query().where('id', ids[1]).update({ status: 'BELUM LULUS' })
    const partial = await issueBulkCertificates(ids.slice(1), null, undefined, expected)
    assert.equal(partial.total_skipped, 1)
    assert.equal(partial.total_created, 1)
    template.version++
    await template.save()
    const changed = await issueBulkCertificates(ids, null, undefined, expected)
    assert.isTrue(changed.paused)
    assert.deepEqual(changed.remaining_ids, ids)
    const snapshot = await IssuedCertificate.findByOrFail('registrationId', ids[0])
    assert.equal(snapshot.templateVersion, 1)
    activity.certificateTemplateId = null
    await activity.save()
    const removed = await issueSingleCertificate(ids[0], null, undefined, {
      ...expected,
      template_version: 2,
    })
    assert.isFalse(removed.success)
    if (!removed.success) assert.equal(removed.error, 'CERTIFICATE_CONTEXT_CHANGED')
  }).skip(process.env.CERTIFICATE_INTEGRATION !== '1')

  test('duplicates managed assets into a publishable draft without changing assignments or snapshots', async ({
    assert,
  }) => {
    const { template, activity, ids, expected } = await fixture(1)
    const asset = `certificate/templates/${template.id}/assets/signature.png`
    await drive.use().put(asset, 'fixture-image')
    template.backgroundImage = asset
    template.templateData.elements.push({
      id: 'signature',
      type: 'signature',
      imageUrl: asset,
      x: 100,
      y: 300,
      width: 150,
      height: 50,
    })
    await template.save()
    await issueSingleCertificate(ids[0], null, undefined, expected)
    const originalIssued = await IssuedCertificate.findByOrFail('registrationId', ids[0])
    const before = originalIssued.serialize()
    const copy = await duplicateCertificateTemplate(template.id)
    assert.equal(copy.lifecycleStatus, 'draft')
    assert.include(copy.backgroundImage!, `certificate/templates/${copy.id}/`)
    assert.equal(copy.templateData.elements[1].imageUrl, copy.backgroundImage)
    assert.isTrue(await drive.use().exists(copy.backgroundImage!))
    const context = await certificateContext()
    context.params = { id: String(copy.id) }
    context.request.updateBody({ expectedVersion: 1, status: 'published' })
    await new CertificateTemplatesController().update(context)
    assert.equal(context.response.getStatus(), 200)
    await activity.refresh()
    assert.equal(activity.certificateTemplateId, template.id)
    const unchangedIssued = await IssuedCertificate.findByOrFail('registrationId', ids[0])
    assert.deepEqual(unchangedIssued.serialize(), before)
    const edit = await certificateContext()
    edit.params = { id: String(template.id) }
    edit.request.updateBody({ expectedVersion: 1, name: 'Changed' })
    await new CertificateTemplatesController().update(edit)
    assert.equal(edit.response.getStatus(), 409)
    assert.equal(edit.response.getBody().message, 'CERTIFICATE_TEMPLATE_USE_DRAFT_COPY')
  }).skip(process.env.CERTIFICATE_INTEGRATION !== '1')

  test('rolls back incomplete asset copies', async ({ assert }) => {
    const { template } = await fixture(0)
    template.backgroundImage = `certificate/templates/${template.id}/background.png`
    await drive.use().put(template.backgroundImage, 'fixture-background')
    template.templateData.elements.push({
      id: 'missing',
      type: 'image',
      imageUrl: `certificate/templates/${template.id}/missing.png`,
      x: 50,
      y: 300,
      width: 100,
      height: 100,
    })
    await template.save()
    const disk = drive.use()
    const copyFile = disk.copy.bind(disk)
    const attemptedKeys: string[] = []
    disk.copy = async (source, target, ...options) => {
      attemptedKeys.push(target)
      return copyFile(source, target, ...options)
    }
    await assert.rejects(() => duplicateCertificateTemplate(template.id))
    const copies = await CertificateTemplate.query().where('name', 'Fixture (Salinan)')
    assert.lengthOf(copies, 0)
    assert.lengthOf(attemptedKeys, 2)
    for (const key of attemptedKeys) assert.isFalse(await disk.exists(key))
    assert.isTrue(await disk.exists(template.backgroundImage))
  }).skip(process.env.CERTIFICATE_INTEGRATION !== '1')

  test('keeps compact results lightweight and the legacy response intact', async ({ assert }) => {
    const { ids, expected } = await fixture(1)
    const compact = await certificateContext()
    compact.request.updateBody({ registration_ids: ids, expected, response_mode: 'compact' })
    await new CertificatesController().issueBulk(compact)
    assert.equal(compact.response.getStatus(), 200)
    const summary = compact.response.getBody().data
    assert.equal(summary.results[0].name, 'Peserta 1')
    assert.equal(summary.results[0].state, 'created')
    assert.notInclude(JSON.stringify(summary), 'template_snapshot')
    assert.notInclude(JSON.stringify(summary), 'template_data')
    const legacy = await certificateContext()
    legacy.request.updateBody({ registration_ids: ids })
    await new CertificatesController().issueBulk(legacy)
    assert.equal(legacy.response.getStatus(), 200)
    assert.lengthOf(legacy.response.getBody().data.already_issued, 1)
    assert.property(legacy.response.getBody().data.already_issued[0], 'template')
    const rows = await listIssuedCertificates({
      activityId: expected.activity_id,
      page: 1,
      perPage: 20,
    })
    assert.equal(rows.data[0].template_name, 'Fixture')
    assert.notInclude(JSON.stringify(rows.data), 'template_snapshot')
  }).skip(process.env.CERTIFICATE_INTEGRATION !== '1')

  test('enforces the 100-recipient API limit before issuance', async ({ assert }) => {
    const context = await certificateContext()
    context.request.updateBody({ registration_ids: Array.from({ length: 101 }, (_, i) => i + 1) })
    await new CertificatesController().issueBulk(context)
    assert.equal(context.response.getStatus(), 422)
  }).skip(process.env.CERTIFICATE_INTEGRATION !== '1')

  test('rejects assignment changes without permission and clears with explicit null', async ({
    assert,
  }) => {
    const { activity } = await fixture(0)
    const denied = await certificateContext()
    denied.params = { id: String(activity.id) }
    denied.request.updateBody({ certificate_template_id: null })
    await new ActivitiesController().update(denied)
    assert.equal(denied.response.getStatus(), 403)
    const allowed = await certificateContext()
    allowed.params = { id: String(activity.id) }
    allowed.request.updateBody({ certificate_template_id: null })
    allowed.authorization = {
      permissions: ['certificate.template.manage'],
      is_super_admin: false,
      role: null,
    }
    await new ActivitiesController().update(allowed)
    assert.equal(allowed.response.getStatus(), 200)
    await activity.refresh()
    assert.isNull(activity.certificateTemplateId)
    assert.isNull(activity.additionalConfig.certificate_template_id)
  }).skip(process.env.CERTIFICATE_INTEGRATION !== '1')
})
