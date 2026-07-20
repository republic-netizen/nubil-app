# Nubli

A study-only AI chat tutor for students. This version is set up so it actually
works once deployed — the earlier prototype called the AI API directly from
the browser, which only worked inside claude.ai's artifact preview and would
never work as a real, standalone product (it had no API key, and putting a
real key in browser code would expose it to anyone who opens dev tools).

This version fixes that: the browser talks to a small server function
(`api/chat.js`), and that server function is the only thing that holds your
real API key.

## What's in this folder

```
nubli-app/
  index.html       the app itself (frontend)
  api/chat.js       the backend function that talks to the AI, keeps your API key private
  package.json
  .env.example      template for your local API key
  .gitignore
```

## 1. Get an API key

1. Go to https://console.anthropic.com and create an account (this is
   separate from your claude.ai login).
2. Go to Settings → API Keys and create a new key.
3. Copy it somewhere safe. You will not be able to see it again after this,
   only regenerate a new one.

This is a paid API — you'll be billed based on usage, not a flat subscription.
For testing and a small number of early users this is typically a few dollars
a month; costs scale with how much your users chat.

## 2. Run it locally (optional, to test before deploying)

You'll need Node.js installed (https://nodejs.org — the LTS version).

```bash
cd nubli-app
cp .env.example .env.local
# open .env.local and paste your real API key in place of "your-api-key-here"

npm install -g vercel
vercel dev
```

This starts a local server (usually at http://localhost:3000) that runs both
the frontend and the backend function together, the same way it'll run once
deployed.

## 3. Deploy it for real (Vercel, free tier works for this)

Vercel is a hosting platform that runs both static sites and small backend
functions like `api/chat.js` for free at this scale.

**Option A — from the Vercel website (no command line needed):**

1. Create a free account at https://vercel.com (you can sign up with GitHub).
2. Push this `nubli-app` folder to a new GitHub repository.
3. In Vercel, click "Add New Project" and import that repository.
4. Before deploying, go to the project's Environment Variables settings and
   add: `ANTHROPIC_API_KEY` = your real key.
5. Click Deploy. Vercel will give you a live URL like `nubli.vercel.app`.

**Option B — from the command line:**

```bash
cd nubli-app
vercel
```

Follow the prompts. Then set your environment variable:

```bash
vercel env add ANTHROPIC_API_KEY
```

Paste your key when asked, then redeploy:

```bash
vercel --prod
```

## 4. Test the live version

Open your deployed URL, pick a subject, and send a message. If something
goes wrong, the app will show a short error message instead of crashing —
common causes:

- **"Server is missing ANTHROPIC_API_KEY"** — you deployed without setting
  the environment variable. Add it in Vercel's project settings and redeploy.
- **"Too many messages. Please wait a moment..."** — the built-in rate
  limiter (20 messages per minute per visitor) kicked in. This protects you
  from a runaway API bill if something sends requests in a loop; adjust
  `MAX_REQUESTS_PER_WINDOW` in `api/chat.js` if you want a different limit.

## What this does NOT include yet

Per the project roadmap, this is intentionally still just the core chat
loop. Not included yet, and worth building next as real users show up:

- User accounts and persistent chat history (currently resets on page reload)
- A production-grade rate limiter (the current one resets whenever the
  server function restarts — fine for early testing, not for real scale)
- Parent/teacher visibility into activity
- Any payment or subscription handling

## A note on the AI's behavior

The rules for what Nubli will and won't answer (study topics only, concise
answers, polite redirects for off-topic questions) live in `api/chat.js`,
inside `SCOPE_AND_STYLE_RULES`. Edit that file to change how it behaves —
never edit `index.html` to try to control AI behavior, since the frontend
has no way to enforce it (a user could just look at the page source).
