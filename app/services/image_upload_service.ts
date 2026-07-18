import sharp from 'sharp'
import drive from '@adonisjs/drive/services/main'

type UploadedImage = {
  tmpPath?: string
}

export type ImageUploadPreset = 'logo' | 'gallery' | 'certificate'

type ImageUploadOptions = {
  maxWidth: number
  maxHeight: number
  maxInputPixels: number
  quality: number
}

const IMAGE_UPLOAD_OPTIONS: Record<ImageUploadPreset, ImageUploadOptions> = {
  logo: {
    maxWidth: 1024,
    maxHeight: 1024,
    maxInputPixels: 16_000_000,
    quality: 90,
  },
  gallery: {
    maxWidth: 2400,
    maxHeight: 2400,
    maxInputPixels: 40_000_000,
    quality: 85,
  },
  certificate: {
    maxWidth: 5000,
    maxHeight: 5000,
    maxInputPixels: 40_000_000,
    quality: 90,
  },
}

export class InvalidImageError extends Error {
  constructor(message = 'INVALID_IMAGE') {
    super(message)
    this.name = 'InvalidImageError'
  }
}

export async function storeOptimizedImage(
  file: UploadedImage,
  keyWithoutExtension: string,
  preset: ImageUploadPreset
): Promise<string> {
  if (!file.tmpPath) {
    throw new InvalidImageError()
  }

  const options = IMAGE_UPLOAD_OPTIONS[preset]
  const key = `${keyWithoutExtension}.webp`
  let contents: Buffer

  try {
    const image = sharp(file.tmpPath, {
      failOn: 'error',
      limitInputPixels: options.maxInputPixels,
    })
    const metadata = await image.metadata()

    if (!metadata.width || !metadata.height) {
      throw new InvalidImageError()
    }

    contents = await image
      .rotate()
      .resize({
        width: options.maxWidth,
        height: options.maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: options.quality, effort: 4 })
      .toBuffer()
  } catch (error) {
    if (error instanceof InvalidImageError) {
      throw error
    }
    throw new InvalidImageError()
  }

  try {
    await drive.use().put(key, contents, {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    })
  } catch (error) {
    await drive
      .use()
      .delete(key)
      .catch(() => undefined)
    throw error
  }

  return key
}
