import Activity from '#models/activity'

function normalizeActivitySlug(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || 'activity'
}

function generateSlugPrefix(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function generateUniqueActivitySlug(name: string): Promise<string> {
  const normalizedName = normalizeActivitySlug(name)

  while (true) {
    const slug = `${generateSlugPrefix()}-${normalizedName}`
    const existingActivity = await Activity.findBy('slug', slug)

    if (!existingActivity) {
      return slug
    }
  }
}
