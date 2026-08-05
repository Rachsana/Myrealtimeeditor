# 📝 CollabDoc — Real-Time Collaborative Editor

A full-stack collaborative document editor that enables multiple users to edit documents simultaneously with live synchronization, authentication, version history, and secure document sharing.

## 🚀 Live Demo

- **Frontend:** https://myrealtimeeditor.vercel.app
- **Backend API:** https://myrealtimeeditor.onrender.com

---

# ✨ Features

- 🔐 JWT Authentication (Register/Login)
- 📝 Create, Edit & Delete Documents
- ⚡ Real-time Collaborative Editing using Socket.IO
- 👥 Live User Presence
- 🖱️ Live Cursor Tracking
- 📧 Invite Collaborators by Email
- 🔗 Share Documents with Secure Links
- 💾 Auto Save
- 📜 Version History
- 🤖 AI-assisted Change Summaries
- 🛡️ Socket-level Authentication
- 🔒 Per-document Authorization
- 🚦 API Rate Limiting
- ☁️ Production Deployment on Vercel & Render
- 🐳 Docker Support
- 🔴 Optional Redis Adapter for Horizontal Scaling

---

# 🛠 Tech Stack

## Frontend

- React (Vite)
- React Router
- Axios
- CSS

## Backend

- Node.js
- Express.js
- Socket.IO
- JWT Authentication
- bcryptjs
- Zod Validation

## Database

- MongoDB Atlas
- Mongoose

## DevOps & Deployment

- Vercel
- Render
- Docker
- Redis (Optional)

---

# 📂 Project Structure

```
CollabDoc/
│
├── client/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── api.js
│   │
│   └── package.json
│
├── server/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── sockets/
│   ├── utils/
│   ├── index.js
│   └── package.json
│
├── docker-compose.yml
├── README.md
└── CHANGES.md
```


## 📸 Screenshots

### Sign Up

![Sign Up](screenshots/signup.png)

---

### Sign In

![Sign In](screenshots/signin.png)

---

### Main Dashboard

![Dashboard](screenshots/main.png)

---

### Invite Collaborator

![Invite](screenshots/invite.png)

# ⚙️ Local Setup

## Clone Repository

```bash
git clone https://github.com/Rachsana/Myrealtimeeditor.git

cd Myrealtimeeditor
```

---

## Backend

```bash
cd server
npm install
```

Create a `.env` file:

```env
PORT=5000

MONGO_URI=your_mongodb_connection_string

JWT_SECRET=your_secret_key

CLIENT_URL=http://localhost:5173

OPENAI_API_KEY=your_openai_api_key_optional

REDIS_URL=redis://redis:6379
```

Run backend

```bash
npm run dev
```

---

## Frontend

```bash
cd client

npm install

npm run dev
```

Visit

```
http://localhost:5173
```

---

# 🐳 Docker

```bash
docker compose up --build
```

Backend

```
http://localhost:5000
```

Frontend

```
http://localhost:5173
```

---

# 🌐 Production Deployment

## Frontend

- Hosted on **Vercel**
- URL:
  https://myrealtimeeditor.vercel.app

Environment Variable

```
VITE_SERVER_URL=https://myrealtimeeditor.onrender.com
```

---

## Backend

Hosted on **Render**

URL

```
https://myrealtimeeditor.onrender.com
```

Environment Variables

```
PORT

MONGO_URI

JWT_SECRET

CLIENT_URL

OPENAI_API_KEY

REDIS_URL (Optional)
```

---

# 🔄 Real-Time Workflow

```
User Types
      │
      ▼
Socket.IO Event
      │
      ▼
Express Server
      │
      ▼
Broadcast to Connected Clients
      │
      ▼
Live Document Update
      │
      ▼
Auto Save to MongoDB
```

---

# 🔒 Security

- JWT Authentication
- Password Hashing using bcryptjs
- Zod Input Validation
- Socket Authentication
- Authorization Middleware
- Rate Limiting
- Protected API Routes

---

# 🚀 Future Improvements

- Rich Text Editing
- Comments
- Mention Users (@username)
- Document Templates
- Export to PDF
- Google Authentication
- Notifications
- Offline Editing
- Conflict Resolution

---

# 👩‍💻 Author

**Rachna Patel**

GitHub

https://github.com/Rachsana

---
