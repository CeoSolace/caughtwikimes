/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    CLOUDINARY_API: process.env.CLOUDINARY_API,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    CLOUDINARY_NAME: process.env.CLOUDINARY_NAME,
    MONGO_URI: process.env.MONGO_URI,
    PASSPHRASE_SALT: process.env.PASSPHRASE_SALT,
    NODE_ENV: process.env.NODE_ENV,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI,
    ADMIN_ENCRYPTION_KEY: process.env.ADMIN_ENCRYPTION_KEY
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*'
      }
    ]
  }
}

module.exports = nextConfig
