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
- Every successful search updates `search_count` and `last_searched_at` inside the film payload
- `/api/top-films` returns the five most concerning films
- The ranking is driven mainly by the vigilance score, with a capped search-popularity boost
- Person names, misspellings and other queries that do not resolve to an identifiable film are excluded
- No additional Supabase table or schema migration is required for the ranking
