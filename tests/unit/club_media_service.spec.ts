import { test } from '@japa/runner'
import { getYoutubeVideoId, hasDuplicateMediaUrls, hasMediaUrl } from '#services/club_media_service'

test.group('Club media identity', () => {
  test('detects duplicate media URLs after trimming incidental whitespace', ({ assert }) => {
    const items = [
      { media_url: 'https://www.youtube.com/embed/video-1' },
      { media_url: ' https://www.youtube.com/embed/video-1 ' },
    ]

    assert.isTrue(hasDuplicateMediaUrls(items))
    assert.isTrue(hasMediaUrl(items, 'https://www.youtube.com/embed/video-1'))
  })

  test('allows distinct media URLs', ({ assert }) => {
    const items = [
      { media_url: 'club/image-1.webp' },
      { media_url: 'https://www.youtube.com/embed/video-1' },
    ]

    assert.isFalse(hasDuplicateMediaUrls(items))
    assert.isFalse(hasMediaUrl(items, 'club/image-2.webp'))
  })

  test('accepts supported YouTube URLs and rejects lookalike hosts or malformed IDs', ({
    assert,
  }) => {
    assert.equal(getYoutubeVideoId('https://www.youtube.com/watch?v=abc_DEF-123'), 'abc_DEF-123')
    assert.equal(getYoutubeVideoId('https://youtu.be/abc_DEF-123?t=12'), 'abc_DEF-123')
    assert.equal(getYoutubeVideoId('https://www.youtube.com/embed/abc_DEF-123'), 'abc_DEF-123')
    assert.isNull(getYoutubeVideoId('https://evil.example/youtube.com/watch?v=abc_DEF-123'))
    assert.isNull(getYoutubeVideoId('javascript:alert(1)'))
    assert.isNull(getYoutubeVideoId('https://www.youtube.com/watch?v=bad/id'))
  })
})
