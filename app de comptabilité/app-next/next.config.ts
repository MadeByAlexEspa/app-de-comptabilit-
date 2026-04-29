import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Les API routes Next.js remplacent le serveur Express
  // Variables d'env publiques exposées au client
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  },
}

export default nextConfig
