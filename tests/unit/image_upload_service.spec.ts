import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'
import { test } from '@japa/runner'
import drive from '@adonisjs/drive/services/main'
import { storeOptimizedImage } from '#services/image_upload_service'

test.group('Image upload service', () => {
  test('rewrites uploads to bounded WebP files with a safe storage key', async ({ assert }) => {
    const tempDirectory = await mkdtemp(join(tmpdir(), 'image-upload-'))
    const inputPath = join(tempDirectory, 'source.jpg')
    const disk = drive.fake()

    try {
      await sharp({
        create: {
          width: 3000,
          height: 1800,
          channels: 3,
          background: '#1677ff',
        },
      })
        .jpeg()
        .toFile(inputPath)

      const key = await storeOptimizedImage(
        { tmpPath: inputPath },
        'activity/42/server-generated-key',
        'gallery'
      )
      const storedImage = sharp(await disk.getBytes(key))
      const metadata = await storedImage.metadata()

      assert.equal(key, 'activity/42/server-generated-key.webp')
      assert.equal(metadata.format, 'webp')
      assert.isAtMost(metadata.width ?? 0, 2400)
      assert.isAtMost(metadata.height ?? 0, 2400)
      assert.isTrue(await disk.exists(key))
    } finally {
      drive.restore()
      await rm(tempDirectory, { recursive: true, force: true })
    }
  })

  test('rejects files that cannot be decoded as images', async ({ assert }) => {
    const tempDirectory = await mkdtemp(join(tmpdir(), 'image-upload-'))
    const inputPath = join(tempDirectory, 'fake.jpg')
    const disk = drive.fake()

    try {
      await writeFile(inputPath, 'not an image')

      await assert.rejects(async () => {
        await storeOptimizedImage({ tmpPath: inputPath }, 'club/fake', 'logo')
      }, /INVALID_IMAGE/)
      assert.isFalse(await disk.exists('club/fake.webp'))
    } finally {
      drive.restore()
      await rm(tempDirectory, { recursive: true, force: true })
    }
  })
})
