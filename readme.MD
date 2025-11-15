# CaughtWiki Discord Clone

A complete Discord clone platform with advanced features including encrypted IDs, admin management, server boosting, and monetization.

## Features

- **Account System**: Temporary and permanent accounts with Discord OAuth
- **Admin Panel**: CEO-only access with staff badges and IP locking
- **Encrypted IDs**: Admin-only decryption system
- **Server Boosting**: Tiered boosting system with premium features
- **Message Management**: 30-minute clearing with active chat protection
- **Reporting System**: Danger reports with evidence preservation
- **Security**: Multi-layer protection, anti-raid systems
- **Monetization**: Subscription tiers and boost system

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables in `.env`
4. Start the development server: `npm run dev`

## Environment Variables

Required environment variables are listed in `.env.example`

## Deployment

The platform is optimized for Render deployment with the provided `render.yaml` configuration.

## Architecture

- Next.js frontend with TypeScript
- Express.js backend with TypeScript
- MongoDB database with Mongoose ODM
- Passport.js for authentication
- Socket.io for real-time communication

## Security Features

- IP-locked admin accounts
- Encrypted user and server IDs
- Automatic message clearing
- Covert reporting system
- Multi-layer security implementation

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)
