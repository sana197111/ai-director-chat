/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // 이 줄 추가
  reactStrictMode: false, // 개발 중 임시로 비활성화
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true, // static export를 위해 추가
  },
  experimental: {
    optimizePackageImports: ['framer-motion', 'lucide-react'],
  },
};

module.exports = nextConfig;