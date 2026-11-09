import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VacinAção',
    short_name: 'VacinAção',
    description: 'Acompanhamento e adesão ao protocolo antirrábico',
    start_url: '/',
    display: 'standalone',
    background_color: '#f9fafb', // bg-gray-50
    theme_color: '#2563eb', // bg-blue-600
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}