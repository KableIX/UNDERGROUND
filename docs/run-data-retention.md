# Run data retention

Decided by TJ on 2026-11-27.

| Data | Kept | Then |
|---|---|---|
| Per-point GPS track (`run_gps_tracks`, `run_checkpoints`) | 90 days | Deleted |
| Speed-derived detail on attempts (`max_speed_mps`, `avg_moving_speed_mps`) | 90 days | Set to null, `raw_purged_at` stamped |
| Summary: average speed, completion time (`active_ms`, finish `duration_ms`), distance, counts | Kept | — |
| On the phone: raw GPS samples of trips ended > 90 days ago, speed detail in local run analytics | 90 days | Deleted / nulled at app start |
| Finish photo capture location (GPS fix) | Until the finish is accepted | Never stored on the server; deleted on the phone right after acceptance |
| Finish photo image | On the member's phone only | Never uploaded (see `finish-photos-on-device.md`) |

Run times and speeds are private. The only shared view is each route's all-time top 3
(`route_all_time_top_three`, `20261127000003_route_top_three_and_photo_privacy.sql`): each member's
single best accepted time with their username. The older `route_top_three`, which listed raw
attempts, was dropped in `20261127000002_private_times_and_retention.sql`.

## Server purge

`public.purge_raw_run_data(retain interval default '90 days')`, service role only. Returns how many
GPS points, checkpoints and attempts it trimmed. It refuses a window shorter than one day.

### Scheduling

- **pg_cron available (Supabase: Database → Extensions → enable `pg_cron`)**: the migration schedules
  `purge-raw-run-data` daily at 03:17 UTC if the extension is already installed when it runs. If you
  enable pg_cron later, schedule it once:

  ```sql
  select cron.schedule('purge-raw-run-data', '17 3 * * *', 'select * from public.purge_raw_run_data()');
  ```

- **No pg_cron**: run it daily from the API host with the service role, e.g. a systemd timer or cron
  entry on Atlas that calls `select * from public.purge_raw_run_data();` via `psql` or the Supabase RPC.

Check it ran: `select * from cron.job_run_details order by start_time desc limit 5;`

## Device purge

`purgeLocalRawRunData()` runs at app start: deletes `gps_samples` for local trips that ended more than
90 days ago (the trip summary stays) and nulls max/moving speed in local run analytics.
