FilmCheck final version with real database

Files to update:
- index.html
- api/analyze.js
- package.json

New file:
- supabase_schema.sql

Environment variables required on Vercel:
- OPENAI_API_KEY
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Supabase setup:
1. Create a Supabase project
2. Open SQL Editor
3. Run the contents of supabase_schema.sql
4. Copy the project URL into SUPABASE_URL
5. Copy the service role key into SUPABASE_SERVICE_ROLE_KEY

Behavior:
- Search a film
- Backend checks Supabase first
- If found: returns saved record instantly
- If not found: calls OpenAI with web search, stores the record in Supabase, then returns it
