FilmCheck AI-backed V1

Files:
- index.html
- api/analyze.js
- package.json
- vercel.json

Deployment:
1. Put `Radial Regular.otf` and `Radial Semi Bold.otf` next to index.html if you want the intended typography.
2. Deploy on Vercel or another platform that supports Node serverless functions.
3. Add the environment variable OPENAI_API_KEY on the server.
4. Install dependencies with npm install.

Behavior:
- The front sends the film title to /api/analyze
- The backend calls the OpenAI Responses API with web search enabled
- The returned JSON is rendered as a FilmCheck record
