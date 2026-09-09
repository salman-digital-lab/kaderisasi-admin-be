import CertificateTemplate from '#models/certificate_template'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'

export function getTemplateAssetKey(value: string, templateId: number): string {
  const prefix = `certificate/templates/${templateId}/`
  const path = /^https?:\/\//.test(value)
    ? decodeURIComponent(new URL(value).pathname).replace(/^\//, '')
    : value
  const index = path.startsWith(prefix) ? 0 : path.indexOf(`/${prefix}`) + 1
  const key = path.startsWith(prefix) || index > 0 ? path.slice(index) : ''
  if (
    !key.startsWith(prefix) ||
    key.split('/').some((part) => part === '..' || part === '.') ||
    key.includes('?')
  ) {
    throw new Error('INVALID_CERTIFICATE_ASSET_KEY')
  }
  return key
}

export async function duplicateCertificateTemplate(sourceId: number): Promise<CertificateTemplate> {
  const copiedKeys: string[] = []
  try {
    return await db.transaction(async (trx) => {
      const source = await CertificateTemplate.query({ client: trx })
        .where('id', sourceId)
        .forUpdate()
        .firstOrFail()
      const copy = await CertificateTemplate.create(
        {
          name: `${source.name.slice(0, 245)} (Salinan)`,
          description: source.description,
          templateData: { ...source.templateData, backgroundUrl: null, elements: [] },
          backgroundImage: null,
          backgroundAssetVersion: 0,
          lifecycleStatus: 'draft',
          isActive: false,
          version: 1,
          publishedAt: null,
          archivedAt: null,
        },
        { client: trx }
      )
      const replacements = new Map<string, string>()
      const copyAsset = async (value: string): Promise<string> => {
        const key = getTemplateAssetKey(value, source.id)
        const existing = replacements.get(key)
        if (existing) return existing
        const extension = key.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? '.webp'
        const target = `certificate/templates/${copy.id}/assets/${randomUUID()}${extension}`
        copiedKeys.push(target)
        await drive.use().copy(key, target)
        replacements.set(key, target)
        return target
      }
      const background = source.backgroundImage || source.templateData.backgroundUrl
      copy.backgroundImage = background ? await copyAsset(background) : null
      copy.templateData = { ...source.templateData, backgroundUrl: null, elements: [] }
      for (const element of source.templateData.elements) {
        copy.templateData.elements.push({
          ...element,
          ...(element.imageUrl ? { imageUrl: await copyAsset(element.imageUrl) } : {}),
        })
      }
      await copy.save()
      return copy
    })
  } catch (error) {
    await Promise.allSettled(copiedKeys.map((key) => drive.use().delete(key)))
    throw error
  }
}
