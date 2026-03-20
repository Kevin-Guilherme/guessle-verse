import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
      { protocol: 'https', hostname: 'assets.pokemon.com' },
      { protocol: 'https', hostname: 'ddragon.leagueoflegends.com' },
      { protocol: 'https', hostname: 'images.igdb.com' },
      { protocol: 'https', hostname: '*.fandom.com' },
      { protocol: 'https', hostname: '*.wikia.nocookie.net' },
      { protocol: 'https', hostname: 'static.wikia.nocookie.net' },
    ],
  },
}

export default nextConfig
