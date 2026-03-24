Fish Map Test v10.7

What changed
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
- if you want private users later, the next step is auth and tighter RLS policies
- device location still requires browser permission and usually works best on HTTPS or localhost
