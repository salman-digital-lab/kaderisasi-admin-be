export type ClubRegistrationQuestionColumn = {
  key: string
  label: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function humanizeKey(key: string): string {
  const words = key
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!words) return 'Pertanyaan'
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function buildClubRegistrationQuestionColumns(
  schema: unknown,
  answerSets: readonly unknown[]
): ClubRegistrationQuestionColumn[] {
  const columns: ClubRegistrationQuestionColumn[] = []
  const knownKeys = new Set<string>()

  if (isRecord(schema) && Array.isArray(schema.fields)) {
    for (const section of schema.fields) {
      if (
        !isRecord(section) ||
        section.section_name === 'profile_data' ||
        !Array.isArray(section.fields)
      ) {
        continue
      }

      for (const field of section.fields) {
        if (
          !isRecord(field) ||
          typeof field.key !== 'string' ||
          typeof field.label !== 'string' ||
          knownKeys.has(field.key)
        ) {
          continue
        }

        knownKeys.add(field.key)
        columns.push({ key: field.key, label: field.label })
      }
    }
  }

  for (const answers of answerSets) {
    if (!isRecord(answers)) continue

    for (const key of Object.keys(answers)) {
      if (knownKeys.has(key)) continue
      knownKeys.add(key)
      columns.push({ key, label: humanizeKey(key) })
    }
  }

  return columns
}

export function formatClubRegistrationAnswer(value: unknown): string | number {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak'
  if (typeof value === 'number') return Number.isFinite(value) ? value : ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value.map((item) => formatClubRegistrationAnswer(item)).join(', ')
  }

  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}
