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
    '/api/ocr': [
      './node_modules/tesseract.js/**/*',
      './node_modules/tesseract.js-core/**/*',
      './node_modules/bmp-js/**/*',
      './node_modules/is-url/**/*',
      './node_modules/node-fetch/**/*',
      './node_modules/regenerator-runtime/**/*',
      './node_modules/wasm-feature-detect/**/*',
      './node_modules/zlibjs/**/*',
      './node_modules/idb-keyval/**/*',
      './node_modules/is-electron/**/*'
    ],
  },
}

export default nextConfig
