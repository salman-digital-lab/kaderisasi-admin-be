import { randomBytes } from 'node:crypto'

type RandomBytesFactory = (size: number) => Buffer

export function generateCertificateCode(
  activityId: number,
  now: Date = new Date(),
  randomBytesFactory: RandomBytesFactory = randomBytes
): string {
  if (!Number.isSafeInteger(activityId) || activityId <= 0) {
    throw new Error('INVALID_ACTIVITY_ID')
  }

  const year = now.getUTCFullYear()
  const entropy = randomBytesFactory(16).toString('hex').toUpperCase()
  return `CERT-${year}-${activityId}-${entropy}`
}
