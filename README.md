# mtcm-workstation

React + Vite + Tailwind + Supabase

## Stack
- React 18 + Vite
- Tailwind CSS
- Supabase (auth, database, edge functions)
- React Router v6

## First-time setup (fresh Supabase project)

### 1. Create a new Supabase project
- Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
- Name it `mtcm-workstation`, pick a region, set a password
- Wait ~2 minutes for provisioning

### 2. Get your API credentials
- In the project dashboard → **Settings → API**
- Copy the **Project URL** and **anon / public key**

### 3. Configure environment
```bash
cp .env.local.example .env.local
# Edit .env.local and fill in your real values:
# VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
# VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### 4. Install dependencies and start the app
```bash
npm install
npm run dev
```

### 5. Link Supabase CLI and push schema
```bash
# Replace <your-project-ref> with the ID from your Supabase project URL
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### 6. Configure Auth redirect URLs
- In Supabase dashboard → **Authentication → URL Configuration**
- Add `http://localhost:5173` to the allowed redirect URLs

### 7. Enable Google OAuth (optional)
1. Go to [Google Cloud Console → APIs & Credentials](https://console.cloud.google.com/apis/credentials) and create an **OAuth 2.0 Client ID** (Web application).
2. Add the Supabase callback URL as an **Authorized redirect URI**:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
3. In Supabase dashboard → **Authentication → Providers → Google**, enable the provider and paste the **Client ID** and **Client Secret**.
4. Add the credentials to your `.env.local`:
   ```
   SUPABASE_AUTH_GOOGLE_CLIENT_ID=your-google-client-id
   SUPABASE_AUTH_GOOGLE_SECRET=your-google-client-secret
   ```

> **Why this is needed:** Without these steps the "Sign in with Google" button returns  
> `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`.

### 7. Deploy edge functions
```bash
npx supabase functions deploy send-emails
```

## Modules
- Command Center (dashboard)
- CRM (contacts, deals)
- Telemarketing (campaigns, call logs)
- DotMail (email campaigns, templates)
- Analytics
