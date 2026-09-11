import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3100'

  const routes = [
    '',
    '/developers',
    '/smart-contract',
    '/deploy-token',
    '/generate',
    '/grants',
    '/pipeline',
    '/fix-deploy',
    '/editor',
    '/jobs',
  ]

  const now = new Date()
  return routes.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.7,
  }))
}
