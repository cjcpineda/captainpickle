# Captain Pickle

AI lineup strategist for Cross Club Pickleball captains.

## Setup

**Requires:** Node 22.13+ and a [Gemini API key](https://aistudio.google.com/apikey)

```bash
git clone https://github.com/cjcpineda/captainpickle.git
cd captainpickle
npm install
cp .env.example .env.local
```

Open `.env.local` and set `GEMINI_API_KEY`.

Create a captain login:

```bash
npm run captain -- you@example.com "Your Name" "Your Team Name" yourpassword
```

Start the app:

```bash
npm run dev
```

Go to http://localhost:3000 and sign in.

## Other commands

| Command | What it does |
| --- | --- |
| `npm run sync` | Pull the latest CPL schedule and results now (it also runs automatically every 6 hours) |
| `npm test` | Run the tests |