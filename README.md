# Study Spark

A small Gemini-powered study assistant. Choose a study mode to get a clear explanation, a summary, a practice quiz, or flashcards from a question or pasted notes.

## Requirements

- Node.js 18 or newer (uses the built-in `fetch` API).
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

## Run locally

1. Copy `.env.example` to `.env`.
2. Replace `your_gemini_api_key_here` with your Gemini API key. Keep `.env` private; it is ignored by Git.
3. Run `npm start` from this folder.
4. Visit [http://localhost:3000](http://localhost:3000).

The server reads `GEMINI_API_KEY` from `.env` or the process environment. Optionally set `GEMINI_MODEL` (default `gemini-3.6-flash`) and `PORT` (default `3000`). The browser only talks to the local `/api/study` endpoint; the server sends the key to Google's Gemini `generateContent` REST endpoint in the `x-goog-api-key` header. The key is never embedded in the page or returned by the server.

## How it works

The interface sends the selected mode and the user's prompt to `POST /api/study`. The server validates the input, adds study-coach instructions for the chosen mode, and calls Gemini. It returns the generated answer as JSON. The page renders that answer as text with basic Markdown formatting, offers a copy button, and shows progress and actionable error messages.

This is a local starter app, not an authenticated multi-user service. If you deploy it publicly, add suitable request limits, monitoring, and abuse protection, and keep the Gemini key in your hosting provider's server-side secret store.
