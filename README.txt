Fishing Logbook v10.8

What changed
- renamed storage and cloud identifiers to fishing-specific names before shared-db rollout
- started the shared-database path with Supabase-ready cloud sync
- logs still save locally first, so poor signal or offline use does not kill the app
- added a Cloud button, cloud status badge, and review-sheet cloud summary
- added supabase-config.js placeholder for browser-side connection details
- added supabase-setup.sql starter schema and row-level-security policies
- save flow now uses explicit app-side validation instead of relying on browser hidden-field tantrums
- existing local logs can be pushed up and merged with shared logs through Cloud Sync

Shared database setup
1. Create a Supabase project.
2. In Supabase, open SQL Editor and run supabase-setup.sql.
3. In Project Settings > API, copy your project URL and anon/publishable key.
4. Open supabase-config.js and paste those two values.
5. Upload the site.
6. Tap Cloud Sync once to push local logs and pull shared logs.

Notes
- this starter uses local-first storage plus manual/automatic cloud sync
- the included SQL policies are intentionally open so every app user can read and write shared logs
- if you already created the older generic fish_logs table, this build will use the new fishing_catch_logs table name instead; migrate or recreate before you start syncing real shared data
- if you want private users later, the next step is auth and tighter RLS policies
- device location still requires browser permission and usually works best on HTTPS or localhost

- Supabase config now uses window.FISHING_SUPABASE_CONFIG instead of a generic global object
- shared table/app identifiers now default to fishing_catch_logs and fishing_logbook_shared
- browser storage now uses fishingLogbook.* keys with a fallback migration from older local keys


Supabase setup:
1. Open supabase-setup.sql in your Supabase SQL Editor and run it.
2. Open supabase-config.js
3. Paste in:
   - url: your Project URL
   - anonKey: your Publishable key (preferred) or legacy anon key
4. Save the file and reload the app.
