# Grok connector for UNDERGROUND beta Newswire

This service exposes two MCP tools at `/mcp`. Both operate on one beta editorial story ID. The upstream is the UNDERGROUND API with its editorial migration, write handler and read-back handler installed.

| Tool | Operation |
| --- | --- |
| `read_story(story_id)` | GET the stored editorial record by stable ID. |
| `put_story(story_id, story)` | PUT the full editorial record and immediately GET the same ID. Returns the stored record in `readBack`. |

Use the deployed beta API's editorial request body for `story`, including its original verification timestamp. Corrections and withdrawals use the same ID. The beta API owns field validation, lifecycle rules, and stale-write detection. Grok should compare the returned record's content and revision with the intended change before marking delivery in its checkpoint. A conflict or uncertain result calls for reading the same ID. The connector has no scheduling, database, run-capture or notification tools.

## Run on the beta host

Python 3.11+ is required by the test suite. From `services/newswire-mcp` on Windows:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m unittest -v
```

Configure these variables in the service process. Keep the two tokens in private secret fields. Never use an xAI account key, a Supabase service-role key or a mobile client variable for either token.

| Variable | Value |
| --- | --- |
| `BETA_API_ORIGIN` | Origin of the deployed beta REST API. Numeric loopback HTTP works for a co-located service. Remote origins require HTTPS. |
| `BETA_EDITORIAL_TOKEN` | Credential accepted by the beta editorial PUT/GET endpoints. |
| `MCP_PUBLIC_ORIGIN` | External HTTPS origin where Grok reaches this connector. Enter just the origin. |
| `GROK_NEWSWIRE_TOKEN` | Separate high-entropy credential for this connector. Supply it to Grok through its private HTTP-header field. |

Start under the host's process supervisor:

```powershell
.\.venv\Scripts\python.exe -m uvicorn server:app --factory --host 127.0.0.1 --port 8641
```

Route HTTPS `/mcp` on the configured public origin to that listener. Preserve the public Host header. The upstream API can stay on loopback when the two processes share a host.

## Connect and verify

In Grok Bot, select **Connect apps → Add a custom connector → Remote HTTPS**. Enter the public origin followed by `/mcp`. Add an `Authorization` header whose value is `Bearer` followed by a space and the connector credential. Attach **UNDERGROUND Beta Newswire** to the existing scout routine. [Grok Bot connector settings](https://docs.x.ai/grok-bot/computer-and-apps)

For acceptance, discover the two tools from Grok, write one owner-visible beta test record using the beta API's documented visibility, read it, then correct it under the same stable ID. Verify the stored revision and single record in the beta UI. Use the beta lifecycle to withdraw the test story. A successful tool listing alone verifies only the Grok-to-connector connection.
