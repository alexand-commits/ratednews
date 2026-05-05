/**
 * Creates a navigate(page, opts) function backed by the Next.js router.
 * Keeps the same API as the old SPA navigate() so no page components need changing.
 */
export function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function createNavigate(router, outlets = []) {
  return function navigate(page, opts = {}) {
    if (typeof window !== 'undefined') window.scrollTo(0, 0)

    switch (page) {
      case 'feed': {
        const params = new URLSearchParams()
        if (opts.category && opts.category !== 'all') params.set('category', opts.category)
        if (opts.region   && opts.region   !== 'all') params.set('region',   opts.region)
        router.push(params.toString() ? `/?${params}` : '/')
        break
      }
      case 'article':
        router.push(`/article/${opts.articleId}`)
        break
      case 'outlet': {
        // Look up outlet name from the allOutlets list so we can make a clean slug URL.
        const outlet = outlets.find(o => o.id === opts.outletId)
        const slug   = outlet ? toSlug(outlet.name) : String(opts.outletId)
        router.push(`/outlet/${slug}`)
        break
      }
      case 'outlets':
        router.push('/outlets')
        break
      case 'categories':
        router.push('/categories')
        break
      case 'category':
        router.push(`/categories/${opts.slug}`)
        break
      case 'rankings':
        router.push('/rankings')
        break
      case 'profile':
        router.push('/profile')
        break
      case 'publicProfile':
        router.push(`/profile/${opts.userId}`)
        break
      case 'about':
        router.push('/about')
        break
      default:
        router.push('/')
    }
  }
}
