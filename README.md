# AI in Education VIP Research Exchange

A collaborative knowledge base for NYU's AI in Education VIP team. This platform features Google SSO authentication (with NYU vs. guest roles) and a Claude-powered AI chatbot to help users explore research entries.

## 🚀 Features

- **Google SSO Authentication**: Sign in with any Google account
  - NYU email addresses (`@nyu.edu`) → TEAM role (can contribute)
  - Other email addresses → Guest role (read-only access)
- **AI-Powered Chatbot**: Ask questions about research entries powered by Claude API
- **Research Repository**: Browse and search through VIP team research
- **Role-Based Permissions**: Team members can contribute and edit content

## 📋 Prerequisites

- Node.js 18+ installed
- Google account
- Anthropic API key ([get one here](https://console.anthropic.com/))
- (For deployment) GitHub account and Render account

## 🏃 Running Locally

### 1. Clone the repository

```bash
git clone https://github.com/landfair/AI_Education_VIP_ResearachExchange.git
cd AI_Education_VIP_ResearachExchange
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment file

Create a `.env` file in the root directory:

```env
ANTHROPIC_API_KEY=your_claude_api_key_here
PORT=3000
```

Replace `your_claude_api_key_here` with your actual Anthropic API key.

### 4. Start the server

```bash
npm start
```

The application will be available at `http://localhost:3000`

### 5. Configure Google Sign-In for local development

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one if needed)
3. Go to **APIs & Services** → **Credentials**
4. Find the OAuth 2.0 Client ID: `65317156873-o4s0gqor74r2nshde0t93jakod1ktutf.apps.googleusercontent.com`
5. Click to edit it
6. Under **Authorized JavaScript origins**, add:
   ```
   http://localhost:3000
   ```
7. Click **Save**

Now you can sign in with Google at `http://localhost:3000`

---

## 🌐 Deploy to Production (Render)

Follow these steps to deploy your application to the internet using Render.

### Step 1: Push to GitHub

Make sure your code is pushed to GitHub:

```bash
git add .
git commit -m "Prepare for production deployment"
git push origin main
```

### Step 2: Create Render Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New +** → **Web Service**
3. Connect your GitHub account if not already connected
4. Select the `AI_Education_VIP_ResearachExchange` repository
5. Configure the service:
   - **Name**: `ai-education-vip-research-exchange` (or choose your own)
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (or upgrade as needed)

### Step 3: Add Environment Variables

In the Render service settings:

1. Scroll to **Environment Variables** section
2. Click **Add Environment Variable**
3. Add:
   - **Key**: `ANTHROPIC_API_KEY`
   - **Value**: Your Anthropic API key
4. Click **Save**

### Step 4: Deploy

1. Click **Create Web Service** (or **Manual Deploy** if already created)
2. Wait for deployment to complete (2-5 minutes)
3. Once deployed, Render will provide your URL: `https://your-service-name.onrender.com`

### Step 5: Configure Google Sign-In for Production

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Find the OAuth 2.0 Client ID: `65317156873-o4s0gqor74r2nshde0t93jakod1ktutf.apps.googleusercontent.com`
4. Click to edit it
5. Under **Authorized JavaScript origins**, add your Render URL:
   ```
   https://your-service-name.onrender.com
   ```
   (Replace `your-service-name` with your actual Render service name)
6. Click **Save**

**Important**: Keep both `http://localhost:3000` (for local dev) and your Render URL in the authorized origins list.

### Step 6: Test Your Deployment

1. Visit your Render URL: `https://your-service-name.onrender.com`
2. Try signing in with Google
3. Test the chatbot functionality
4. Verify that:
   - NYU email users see "TEAM" badge and can access contribute features
   - Non-NYU users are guests with read-only access

---

## 🔧 Project Structure

```
AI_Education_VIP_ResearachExchange/
├── public/                    # Static frontend files
│   ├── index.html            # Main HTML page
│   ├── auth.js               # Google SSO authentication
│   ├── chatbot.js            # AI chatbot interface
│   └── entriesIndex.js       # Research entries data
├── server.js                 # Express server (serves frontend + API)
├── package.json              # Dependencies and scripts
├── render.yaml               # Render deployment configuration
├── .env                      # Environment variables (local only, not in git)
├── .gitignore                # Git ignore rules
└── README.md                 # This file
```

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | API key for Claude AI | Yes |
| `PORT` | Server port (auto-set by Render in production) | No (defaults to 3000) |

## 🛠️ Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server (same as start)

## 📝 Notes

### Google SSO Configuration

The application uses this Google OAuth Client ID:
```
65317156873-o4s0gqor74r2nshde0t93jakod1ktutf.apps.googleusercontent.com
```

You must add your domain (both local and production) to the **Authorized JavaScript origins** in Google Cloud Console for sign-in to work.

### API Endpoint

The frontend calls `/api/chat` as a relative path, which automatically works for both:
- Local development: `http://localhost:3000/api/chat`
- Production: `https://your-service-name.onrender.com/api/chat`

### CORS

CORS is enabled on the backend to allow requests. Since the frontend and backend are served from the same origin in production, there should be no CORS issues.

### Free Tier Limitations

Render's free tier:
- Services spin down after 15 minutes of inactivity
- First request after idle may take 30-60 seconds (cold start)
- 750 hours/month of runtime

Consider upgrading to a paid plan for production workloads.

## 🐛 Troubleshooting

### Google Sign-In doesn't work

1. Check that you've added your URL to **Authorized JavaScript origins** in Google Cloud Console
2. Make sure you're using the correct Client ID in `auth.js`
3. Clear your browser cache and cookies
4. Check browser console for errors

### Chatbot not responding

1. Verify `ANTHROPIC_API_KEY` is set correctly in Render environment variables
2. Check Render logs for API errors
3. Ensure you have Claude API credits available

### Site not loading after deployment

1. Check Render logs for startup errors
2. Verify `npm start` command is configured correctly
3. Ensure all dependencies are in `package.json`
4. Check that `PORT` environment variable is being respected

## API Endpoints

### `GET /`
Serves the main application (index.html)

### `GET /api/health`
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-20T12:00:00.000Z"
}
```

### `POST /api/chat`
AI chatbot endpoint

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "What is AI in education?" }
  ],
  "entries": [
    {
      "id": "entry-id",
      "title": "Entry Title",
      "url": "/#entry-id",
      "snippet": "Summary..."
    }
  ]
}
```

**Response:**
```json
{
  "message": "AI in education refers to...",
  "usage": { "input_tokens": 100, "output_tokens": 200 },
  "modelUsed": "claude-3-5-sonnet-20241022"
}
```

## User Roles & Permissions

| Feature | Guest | Team Member (@nyu.edu) |
|---------|-------|------------------------|
| Browse & read entries | ✅ | ✅ |
| Search entries | ✅ | ✅ |
| Use AI chatbot | ✅ | ✅ |
| Create entries | ❌ | ✅ |
| Edit entries | ❌ | ✅ |

## 📄 License

ISC

## 👥 Contributors

NYU AI in Education VIP Team

---

## 🎉 You're Done!

Once you complete the steps above, anyone on the internet can:
1. Visit your Render URL
2. Sign in with their Google account
3. Browse research entries
4. Use the AI chatbot to ask questions
5. (NYU users only) Contribute new content

**Questions?** Check the [GitHub Issues](https://github.com/landfair/AI_Education_VIP_ResearachExchange/issues) or contact the VIP team.
