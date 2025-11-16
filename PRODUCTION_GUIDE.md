# Production Deployment Guide

## Overview
This guide will help you deploy your Omegle clone for college students to production.

## Prerequisites
- Node.js 18+ installed
- MongoDB database (MongoDB Atlas recommended for production)
- Domain name (optional but recommended)
- SSL certificate (required for HTTPS - WebRTC requires secure context)

## Backend Setup

### 1. Environment Variables
Create a `.env` file in the `backend` directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/omegle-clone?retryWrites=true&w=majority

# CORS - Update with your frontend URL
CORS_ORIGIN=https://yourdomain.com

# WebRTC STUN/TURN Servers
STUN_SERVER=stun:stun.l.google.com:19302
# For production, you'll need a TURN server (see below)
TURN_SERVER=turn:your-turn-server.com:3478
TURN_USERNAME=your-turn-username
TURN_CREDENTIAL=your-turn-password

# JWT Secret (generate a strong random string)
JWT_SECRET=your-very-strong-secret-key-here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 2. Install Dependencies
```bash
cd backend
npm install
```

### 3. Build TypeScript
```bash
npm run build
```

### 4. Start Server
```bash
npm start
```

For production, use a process manager like PM2:
```bash
npm install -g pm2
pm2 start dist/index.js --name omegle-backend
pm2 save
pm2 startup
```

## Frontend Setup

### 1. Environment Variables
Create a `.env` file in the `frontend` directory:

```env
VITE_BACKEND_URL=your-backend-domain.com
```

### 2. Install Dependencies
```bash
cd frontend
npm install
```

### 3. Build for Production
```bash
npm run build
```

### 4. Serve Frontend
The `dist` folder contains your production build. You can serve it with:
- Nginx
- Apache
- Vercel
- Netlify
- Any static file server

## Database Setup

### MongoDB Atlas (Recommended)
1. Create an account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Create a database user
4. Whitelist your server IP (or 0.0.0.0/0 for all IPs - less secure)
5. Get your connection string and add it to `.env`

### Local MongoDB
If running MongoDB locally:
```bash
# macOS
brew install mongodb-community
brew services start mongodb-community

# Linux
sudo apt-get install mongodb
sudo systemctl start mongodb
```

## WebRTC TURN Server Setup

For production, you'll need a TURN server for users behind NAT/firewalls.

### Option 1: Use a TURN Service
- [Twilio STUN/TURN](https://www.twilio.com/stun-turn)
- [Xirsys](https://xirsys.com/)
- [Metered TURN](https://www.metered.ca/tools/openrelay/)

### Option 2: Self-Hosted TURN Server
Use [coturn](https://github.com/coturn/coturn):

```bash
# Install coturn
sudo apt-get install coturn

# Configure /etc/turnserver.conf
listening-port=3478
realm=yourdomain.com
server-name=yourdomain.com
user=username:password
```

## Security Checklist

- [ ] Use HTTPS (required for WebRTC)
- [ ] Set strong JWT_SECRET
- [ ] Configure CORS properly (don't use "*" in production)
- [ ] Set up rate limiting
- [ ] Enable MongoDB authentication
- [ ] Use environment variables (never commit .env)
- [ ] Set up logging and monitoring
- [ ] Configure firewall rules
- [ ] Set up SSL/TLS certificates
- [ ] Enable helmet.js security headers

## Deployment Options

### Backend
- **Heroku**: Easy deployment, includes MongoDB addon
- **DigitalOcean**: App Platform or Droplets
- **AWS**: EC2, Elastic Beanstalk, or ECS
- **Google Cloud**: App Engine or Compute Engine
- **Railway**: Simple deployment with database

### Frontend
- **Vercel**: Excellent for React apps
- **Netlify**: Great static hosting
- **Cloudflare Pages**: Fast CDN
- **AWS S3 + CloudFront**: Scalable solution

## Monitoring & Logging

### Logs
Logs are saved in `backend/logs/`:
- `error.log`: Error logs
- `combined.log`: All logs

### Monitoring Tools
- **PM2**: Process monitoring
- **Sentry**: Error tracking
- **New Relic**: Application monitoring
- **Datadog**: Full-stack monitoring

## Next Steps for Production

1. **User Authentication**: Implement college email verification
2. **Moderation**: Add admin panel for reviewing reports
3. **Analytics**: Track usage metrics
4. **Scaling**: Consider Redis for session management
5. **CDN**: Use CDN for static assets
6. **Load Balancing**: For high traffic
7. **Database Indexing**: Optimize MongoDB queries
8. **Caching**: Implement Redis caching

## Support

For issues or questions, check the logs in `backend/logs/` or review the application logs.



