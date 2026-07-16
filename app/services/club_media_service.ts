type MediaUrlItem = {
  media_url: string
}

const normalizeMediaUrl = (mediaUrl: string): string => mediaUrl.trim()

export function hasMediaUrl(items: readonly MediaUrlItem[], mediaUrl: string): boolean {
  const normalizedMediaUrl = normalizeMediaUrl(mediaUrl)

  return items.some((item) => normalizeMediaUrl(item.media_url) === normalizedMediaUrl)
}

export function hasDuplicateMediaUrls(items: readonly MediaUrlItem[]): boolean {
  const mediaUrls = new Set<string>()

  for (const item of items) {
    const mediaUrl = normalizeMediaUrl(item.media_url)
    if (mediaUrls.has(mediaUrl)) {
      return true
    }
    mediaUrls.add(mediaUrl)
  }

  return false
}

export function getYoutubeVideoId(value: string): string | null {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null

    const hostname = url.hostname.toLowerCase()
    let videoId: string | null = null

    if (hostname === 'youtu.be') {
      videoId = url.pathname.split('/').filter(Boolean)[0] ?? null
    } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(hostname)) {
      if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v')
      } else if (url.pathname.startsWith('/embed/')) {
        videoId = url.pathname.split('/')[2] ?? null
      }
    }

    return videoId && /^[a-zA-Z0-9_-]{6,20}$/.test(videoId) ? videoId : null
  } catch {
    return null
  }
}
