# Vibely

Vibely is a modern full-stack messaging, status, and calling platform inspired by WhatsApp Web, but designed as a more premium real-time workspace. It combines private messaging, media sharing, disappearing statuses, session management, and audio/video calling in a polished web experience.

## Highlights

- Real-time 1:1 and group messaging with Socket.IO
- Username-based people search and privacy-focused profiles
- Chat request accept/reject flow for new direct conversations
- Message reactions, edit/delete, read receipts, pinning, and polls
- WhatsApp-style status flow with 24-hour expiry and seen tracking
- Audio calls, video calls, group calling, and screen sharing
- Multi-session account management with device/location visibility
- Forgot-password OTP flow, Google sign-in, and device-aware sessions
- PWA support with installable manifest and service worker
- Responsive UI for mobile, tablet, and desktop

## Tech Stack

### Frontend

- React 18
- Vite
- Tailwind CSS
- Zustand
- Socket.IO Client
- Framer Motion
- WebRTC

### Backend

- Node.js
- Express
- MongoDB with Mongoose
- Socket.IO
- Redis (optional)
- Cloudinary
- JWT authentication

## Repository Structure

```text
.
├── client/   # Vite + React frontend
├── server/   # Express + Socket.IO backend
└── package.json
```

## Core Features

### Messaging

- Instant messaging with online, typing, and seen states
- Direct and group chats
- Message reactions
- Edit and delete message flows
- Poll messages in groups
- Media and document uploads
- Multiple pinned chats

### Privacy and Identity

- Username-first discovery
- Name + username shown instead of exposing emails in user discovery
- Contacts system
- Mutual-contact status visibility
- Session management and revoke controls

### Status

- Text, image, and video statuses
- 24-hour expiry
- Real-time status refresh
- Seen-by details for status owners
- Owner delete flow with confirmation

### Calling

- 1:1 audio and video calling
- Group audio and video calling
- Screen sharing in video calls
- In-call participant state indicators
- Minimized call overlay

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/vibely.git
cd vibely
```

### 2. Install dependencies

From the repo root:

```bash
npm install
npm run install:all
```

Or install manually:

```bash
cd server && npm install
cd ../client && npm install
```

### 3. Configure environment variables

Create `.env` files in both `server/` and `client/`.

#### `server/.env`

```env
PORT=5000
NODE_ENV=development
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_access_token_secret
REFRESH_SECRET=your_refresh_token_secret

CLIENT_URL=http://localhost:5173

GOOGLE_CLIENT_ID=your_google_client_id

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

EMAIL_SCRIPT_URL=your_email_service_endpoint
TRUST_PROXY=false
```

Notes:

- `MONGO_URI`, `JWT_SECRET`, and `REFRESH_SECRET` are required.
- `CLIENT_URL` is strongly recommended in production for CORS.
- `CLIENT_URL` can be a comma-separated list of allowed frontend origins.
- `GOOGLE_CLIENT_ID`, Cloudinary, and email settings are optional depending on which features you use.

#### `client/.env`

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

## Run the App

### Run both frontend and backend

From the repo root:

```bash
npm run dev
```

### Run each service separately

Backend:

```bash
cd server
npm run dev
```

Frontend:

```bash
cd client
npm run dev
```

## Verification

Run the repo-level verification command from the root:

```bash
npm run verify
```

This currently runs:

- environment preflight
- backend syntax checks
- frontend production build

## API Health Check

Once the backend is running, verify it with:

```bash
http://localhost:5000/api/health
```

Example production health route:

```text
https://your-backend-domain/api/health
```

## Deployment

### Frontend on Vercel

Recommended settings:

- Framework Preset: `Vite`
- Root Directory: `client`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`
- Development Command: `npm run dev`

Frontend environment variables:

```env
VITE_API_URL=https://your-backend-domain
VITE_SOCKET_URL=https://your-backend-domain
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

Note:

- `VITE_API_URL` can be the backend root URL or the `/api` URL. The client normalizes it automatically.

### Backend on Render

Recommended settings:

- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm start`

Backend environment variables:

```env
NODE_ENV=production
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_access_token_secret
REFRESH_SECRET=your_refresh_token_secret
CLIENT_URL=https://your-frontend-domain.vercel.app
GOOGLE_CLIENT_ID=your_google_client_id
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
EMAIL_SCRIPT_URL=your_email_service_endpoint
TRUST_PROXY=true
```

If you use more than one frontend origin, `CLIENT_URL` may contain comma-separated values.

## PWA Support

The frontend includes:

- web app manifest
- service worker
- installable Chrome experience on HTTPS or `localhost`

## Security Notes

- JWT access + refresh token auth
- Session-aware authentication with revoke support
- Revoked sessions are blocked from protected HTTP and socket flows
- Upload MIME validation for avatars, statuses, and media
- CORS origin validation for browser clients
- Generic responses for verification and password reset requests to reduce account enumeration

## Product Direction

Vibely is built as a premium messaging platform, not just a demo chat app. The current product includes:

- premium responsive UI
- real-time presence
- contact-aware status visibility
- session/device management
- modern call experience

There is still room for future work such as:

- advanced search
- view-once media with timers
- richer call diagnostics and device selection
- more automated test coverage

## Scripts

### Root

```bash
npm run dev
npm run install:all
npm run build:client
npm run check:env
npm run check:server
npm run check:client
npm run verify
```

### Frontend

```bash
cd client
npm run dev
npm run build
npm run preview
```

### Backend

```bash
cd server
npm run dev
npm start
```

## License

This project is open source and available under the MIT License.
