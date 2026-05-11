/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['tesseract.js'],
  outputFileTracingIncludes: {
    '/api/ocr': ['./node_modules/tesseract.js/**/*', './node_modules/tesseract.js-core/**/*'],
  },
}

export default nextConfig
