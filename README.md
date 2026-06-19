# 📝 CollabDoc — Real-Time Collaborative Editor

A full-stack real-time document collaboration app built with React, Node.js, Socket.io, and MongoDB.

## 🔥 Features
- Real-time collaborative editing with WebSockets
- JWT authentication (register / login)
- Create, edit, delete documents
- Invite collaborators by email
- Live presence — see who's online
- Auto-save every 2 seconds
- Share document link

## 🛠 Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | React (Vite), React Router, Axios |
| Backend | Node.js, Express, Socket.io |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |
| Validation | Zod |

## 📁 Project Structure
```
collabdoc/
├── server/
│   ├── models/       # User.js, Document.js
│   ├── routes/       # auth.js, docs.js
│   ├── middleware/   # auth.js (JWT verify)
│   └── index.js      # Express + Socket.io entry
└── client/
    └── src/
        ├── pages/    # Login, Register, Home, Editor
        ├── App.jsx
        └── api.js    # Axios instance
```

## 📸 Snapshots

![Signup](screenshots/signup.png)
![Signin](screenshots/signin.png)
![main](screenshots/main.png)
![invite](screenshots/invite.png)

## 🚀 Setup Instructions

### 1. MongoDB Atlas
- Go to https://cloud.mongodb.com
- Create a free cluster
- Get your connection string

### 2. Server
```bash
cd server
npm install
cp .env.example .env
# Fill in MONGO_URI and JWT_SECRET in .env
npm run dev
```

### 3. Client
```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173

## 🌐 Deployment
- **Backend** → Render.com (free tier, supports WebSockets)
- **Frontend** → Vercel (free tier)
- Set `VITE_SERVER_URL` in Vercel env vars to your Render URL

## 💡 How Real-Time Sync Works
1. User types → frontend emits `send-changes` with new content over WebSocket
2. Server receives it → broadcasts `receive-changes` to all others in the same document room
3. Other clients receive it → update their textarea instantly
4. Every 2 seconds → `save-doc` event persists content to MongoDB
