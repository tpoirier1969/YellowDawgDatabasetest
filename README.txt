Fishing Logbook v10.36.0

What changed
- unified the main action flow across phone, tablet, and desktop so the main action buttons sit at the bottom in a 2-column grid everywhere
- Map Only and Menu controls now work as the same map/menu toggle flow across screen sizes
- tightened the header so the build note no longer stomps on the app title
- Add Log now refreshes Time of Day when you tap Add Log
- Use My Location and Pick on Map stay side by side
- Date and Time of Day stay side by side
- removed Waypoint and Sharing Preview from the visible Add Log form for now
- moved Water Type and Water Conditions onto one row
- added Wind
- added Water Depth (ft) as a separate field from Presented Depth
- Presented Depth now clearly means where the bait or fly was worked in the water column
- Hatches only shows for Fly entries
- lure type helper text now gives plain-English example lures so categories like Swimbait are less cryptic
- validation no longer falsely requires lure-only fields for every bait type

Important Supabase note
- rerun supabase-setup.sql in Supabase for this build if you want cloud sync to keep the new Wind and Water Depth fields

Notes
- presentation depth still uses the existing depth-zone field under the hood; the UI label is what changed
- map-only mode is a view toggle and does not change data
- local save behavior is unchanged
