export const config = {
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/caughtwiki',
  PASSPHRASE_SALT: process.env.PASSPHRASE_SALT || 'default_salt',
  PORT: parseInt(process.env.PORT || '3000'),
  CLOUDINARY_API: process.env.CLOUDINARY_API || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  CLOUDINARY_NAME: process.env.CLOUDINARY_NAME || '',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '',
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || '',
  DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/api/auth/discord/callback',
  ADMIN_ENCRYPTION_KEY: process.env.ADMIN_ENCRYPTION_KEY || 'default_key',
  NODE_ENV: process.env.NODE_ENV || 'development'
};
