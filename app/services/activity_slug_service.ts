import Activity from '#models/activity'

function normalizeActivitySlug(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .trim()
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\p{Separator}\p{Dash_Punctuation}\s]+/gu, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || 'activity'
}

export async function generateUniqueActivitySlug(name: string): Promise<string> {
  const baseSlug = normalizeActivitySlug(name)
  let slug = baseSlug
  let suffix = 2

  while (await Activity.findBy('slug', slug)) {
    slug = `${baseSlug}-${suffix}`
    suffix += 1
  }

  return slug
}
