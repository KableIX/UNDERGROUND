# Beta Newswire publisher

The existing beta API serves `/v1/newswire/editorial/{story_id}`. Use PUT for a full replacement and GET for read-back. Stable IDs can include a namespace, for example `100oct/holiday-2026`. Use the same ID when the venue, time or status changes. Both operations require `Authorization: Bearer <editorial-token>`.

## Provision the beta

1. Apply `supabase/migrations/20261112000001_editorial_newswire.sql` to the beta database. It depends on the app's existing member schema. Authenticated members can read current published stories. Member sessions cannot write editorial stories.
2. Generate a 32-byte random secret encoded as base64url in a secret manager. Set `NEWSWIRE_EDITORIAL_TOKEN_SHA256` on the beta API to the lowercase SHA-256 hex digest of the exact encoded token (no newline). Store the original token only in the publisher's masked credential field. Rotating the server digest revokes the old token.
3. Deploy the API to the beta HTTPS host with APP_ENV=staging and its existing server-side Supabase configuration. The member app uses its own authenticated Supabase client pointing at the same beta database. Ship the updated Newswire screen to beta. The publisher receives only the editorial token and the API URL.
4. For the next confirmed story, PUT, then GET the same ID and compare the returned fields. Confirm the active story is visible to a signed-in beta member. Withdrawn or expired stories remain readable to the publisher and are hidden from members.

## JSON contract

PUT accepts exactly the following fields. Times are ISO 8601 with an offset. Source URLs must be HTTPS. The body contains the complete member-facing text. Supply the member action as the link label.

```json
{
  "headline": "Example event title",
  "body": "Confirmed date, location, eligibility and material change.",
  "action_label": "Check organizer registration",
  "source_url": "https://example.org/event",
  "verified_at": "2026-11-12T12:00:00-08:00",
  "expires_at": "2026-11-16T00:00:00-08:00",
  "withdrawn": false
}
```

A successful GET or PUT returns HTTP 200 and the persisted row. Identical retries keep the original publication time. A stale update or a different payload with the same verification time returns 409. Read the current row before retrying. For a withdrawal, submit the full story with a later verification time and withdrawn=true. A confirmed cancellation can remain visible as a correction until its expiry.

401 indicates a missing or incorrect bot token, 404 an unknown story on GET, 422 an invalid payload, 503 a disabled or unconfigured publisher and 502 a database failure. The connector needs only these two operations. This endpoint sends no push notifications.
