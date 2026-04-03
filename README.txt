Fishing Logbook v10.34.0

What changed
- phone layout cleaned up so the main action buttons sit at the bottom in a 2-column grid
- added a Map Only toggle on phones so you can look at the map without the big action dock sitting on top of it
- tightened the header so the build note no longer stomps on the app title
- Add Log now refreshes Time of Day when you tap Add Log
- Use My Location and Pick on Map stay side by side on phones
- Date and Time of Day stay side by side on phones
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
- map-only mode is a view toggle for phones and does not change data
- local save behavior is unchanged
