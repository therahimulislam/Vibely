# Vibely - Real-Time Messaging Platform

Vibely is a modern, full-stack real-time messaging application inspired by WhatsApp but with a unique glassmorphism aesthetic. It features real-time chat, image sharing, and end-to-end encrypted video calls.

![Vibely Preview](https://via.placeholder.com/800x400?text=Vibely+Preview)

## 🚀 Features

- **Real-time Messaging**: Instant message delivery using Socket.io.
- **Glassmorphism UI**: Premium, modern design with animated gradients and glass effects.
- **Video Calls**: End-to-end encrypted video calls using WebRTC.
- **Media Sharing**: Image upload support via Cloudinary.
- **Secure Auth**: JWT-based authentication with Google OAuth support.
- **Interactive**: Typing indicators, online status, message reactions, and read receipts.
- **Session Management**: View active sessions, identify current device, and revoke suspicious sessions.
- **Responsive**: Fully responsive design for desktop and mobile.

## 🛠 Tech Stack

**Frontend:**
- React + Vite
- Tailwind CSS (Glassmorphism design system)
- Zustand (State management)
- Socket.io Client
- Simple-Peer / WebRTC

**Backend:**
- Node.js + Express
- MongoDB (Mongoose)
- Socket.io
- Redis (Online status cache)
- Cloudinary (Media storage)

## 📦 Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/vibely.git
    cd vibely
    ```

2.  **Install Dependencies**
    ```bash
    # Install root dependencies
    npm install

    # Install Backend dependencies
    cd server
    npm install

    # Install Frontend dependencies
    cd ../client
    npm install
    ```

3.  **Environment Setup**
    Create `.env` files in both `server/` and `client/` directories.

    **Server (`server/.env`):**
    ```env
    PORT=5000
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret
    REFRESH_SECRET=your_refresh_secret
    CLIENT_URL=http://localhost:5173
    CLOUDINARY_CLOUD_NAME=your_cloud_name
    CLOUDINARY_API_KEY=your_api_key
    CLOUDINARY_API_SECRET=your_api_secret
    ```

    **Client (`client/.env`):**
    ```env
    VITE_API_URL=http://localhost:5000/api
    VITE_SOCKET_URL=http://localhost:5000
    VITE_GOOGLE_CLIENT_ID=your_google_client_id
    ```

4.  **Run the App**
    ```bash
    # Run both client and server concurrently (from root)
    npm start
    
    # OR run separately:
    # Terminal 1:
    cd server && npm run dev
    # Terminal 2:
    cd client && npm run dev
    ```

## 🚀 Deployment

- **Frontend**: Deploy `client` folder to Vercel/Netlify.
- **Backend**: Deploy `server` folder to Render/Railway/Heroku.
- **Database**: Use MongoDB Atlas.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open sourced under the MIT license.
