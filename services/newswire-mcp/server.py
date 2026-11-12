"""Expose the UNDERGROUND beta editorial API as two scoped Grok tools."""
import hmac
import os
from typing import Annotated, Any
from urllib.parse import quote, urlsplit

import httpx
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations
from pydantic import Field
from starlette.responses import Response

STORY_ID_PATTERN = r"^[A-Za-z0-9_-][A-Za-z0-9_.:-]*(/[A-Za-z0-9_-][A-Za-z0-9_.:-]*)*$"
StoryId = Annotated[str, Field(pattern=STORY_ID_PATTERN, min_length=1, max_length=256)]
Story = dict[str, Any]


def origin(value: str, *, local_api: bool = False) -> str:
    parts = urlsplit(value)
    local_http = (local_api and parts.scheme == "http"
                  and parts.hostname in {"127.0.0.1", "::1"})
    if (not parts.hostname or parts.username is not None or parts.password is not None
            or parts.path not in ("", "/") or parts.query or parts.fragment
            or (parts.scheme != "https" and not local_http)):
        raise ValueError("Configure an HTTPS origin, or a numeric loopback HTTP beta API origin.")
    return f"{parts.scheme}://{parts.netloc}"


class EditorialAPI:
    def __init__(self, api_origin: str, token: str, transport=None):
        self.base = origin(api_origin, local_api=True)
        self.headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        self.transport = transport

    async def request(self, method: str, story_id: str, story: Story | None = None):
        # Encode the entire stable ID as one path component, including any organizer slash.
        url = f"{self.base}/v1/newswire/editorial/{quote(story_id, safe='')}"
        try:
            async with httpx.AsyncClient(headers=self.headers, transport=self.transport,
                                         timeout=12, follow_redirects=False, trust_env=False) as client:
                response = await client.request(method, url, json=story)
        except httpx.RequestError:
            raise ValueError(f"Beta {method} could not be confirmed. Read this ID before retrying.") from None
        if not response.is_success:
            raise ValueError(f"Beta {method} returned HTTP {response.status_code}.")
        if method == "PUT" and not response.content:
            return None
        try:
            value = response.json()
        except (ValueError, UnicodeError):
            raise ValueError(f"Beta {method} returned invalid JSON.") from None
        if not isinstance(value, dict) or value.get("ok") is False or not value:
            raise ValueError(f"Beta {method} did not return a successful editorial record.")
        if method == "GET" and set(value) == {"ok"}:
            raise ValueError("Beta GET returned an acknowledgment without a story.")
        return value


def create_app(public_origin: str, api: EditorialAPI, connector_token: str):
    public = origin(public_origin)
    # Both credentials are supplied by the deployer. The Grok credential stops here.
    if not connector_token or not api.headers["Authorization"].removeprefix("Bearer "):
        raise ValueError("Both the connector and beta editorial credentials are required.")
    expected = connector_token.encode("ascii")
    if hmac.compare_digest(f"Bearer {connector_token}", api.headers["Authorization"]):
        raise ValueError("Use separate credentials for Grok and the beta API.")
    mcp = FastMCP(
        "UNDERGROUND Beta Newswire", stateless_http=True, json_response=True,
        max_request_body_size=128 * 1024,
        transport_security=TransportSecuritySettings(
            allowed_hosts=[urlsplit(public).netloc], allowed_origins=[public],
        ),
        instructions="Use stable story IDs. Only send confirmed editorial material to beta. "
        "Keep private locations, review leads and alert suppression in the scout checkpoint. "
        "Compare the stored record with the intended revision before marking it delivered.",
    )

    @mcp.tool(annotations=ToolAnnotations(readOnlyHint=True, destructiveHint=False))
    async def read_story(story_id: StoryId) -> Story:
        """Read the beta editorial record stored under this exact stable ID."""
        return await api.request("GET", story_id)

    @mcp.tool(annotations=ToolAnnotations(readOnlyHint=False, idempotentHint=True, destructiveHint=True))
    async def put_story(story_id: StoryId, story: Story) -> Story:
        """Create, correct or withdraw one story using the beta editorial PUT body.
        Use the deployed API's field names and lifecycle values. Reuse the exact ID
        and body for retries. Returns the GET response for comparison to this revision.
        """
        if not story:
            raise ValueError("Supply the editorial record.")
        await api.request("PUT", story_id, story)
        try:
            stored = await api.request("GET", story_id)
        except ValueError as exc:
            raise ValueError(f"Beta accepted the write. Read-back failed: {exc} "
                             "Retry read_story with the same ID.") from None
        return {"requestedStoryId": story_id, "readBack": stored}

    application = mcp.streamable_http_app()

    async def authenticated(scope, receive, send):
        if scope["type"] == "http":
            auth = [v for k, v in scope["headers"] if k == b"authorization"]
            scheme, _, token = auth[0].partition(b" ") if len(auth) == 1 else (b"", b"", b"")
            if scheme.lower() != b"bearer" or not hmac.compare_digest(token, expected):
                response = Response(status_code=401, headers={
                    "WWW-Authenticate": 'Bearer realm="underground-beta-newswire"',
                    "Cache-Control": "no-store",
                })
                return await response(scope, receive, send)
        await application(scope, receive, send)

    return authenticated


def app():
    """Uvicorn factory. No sample credentials or fallback upstream."""
    api = EditorialAPI(os.environ["BETA_API_ORIGIN"], os.environ["BETA_EDITORIAL_TOKEN"])
    return create_app(os.environ["MCP_PUBLIC_ORIGIN"], api, os.environ["GROK_NEWSWIRE_TOKEN"])
