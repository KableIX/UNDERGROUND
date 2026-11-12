import asyncio
import json
import socket
import unittest
from contextlib import asynccontextmanager

import httpx
import uvicorn
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

from urllib.parse import unquote

from server import EditorialAPI, create_app, origin


def story(revision=1, withdrawn=False):
    return {"headline": "Fixture", "body": "Beta test", "action_label": "Source",
            "source_url": "https://example.org/", "verified_at": f"2026-11-12T01:00:0{revision}Z",
            "expires_at": "2026-11-13T00:00:00Z", "withdrawn": withdrawn}


class ConnectorTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.requests = []
        self.rows = {}
        self.read_failure = False
        self.redirect = False
        self.read_override = {}

        def beta(req):
            self.requests.append(req)
            if req.headers["authorization"] != "Bearer fixture-api":
                return httpx.Response(403)
            if self.read_failure and req.method == "GET":
                return httpx.Response(503)
            key = req.url.raw_path
            if req.method == "PUT":
                body = json.loads(req.content)
                if key in self.rows and body["verified_at"] < self.rows[key]["verified_at"]:
                    return httpx.Response(409)
                if self.redirect:
                    return httpx.Response(307, headers={"location": "https://elsewhere.invalid"})
                self.rows[key] = {**body, "story_id": unquote(req.url.path.split("/editorial/")[1])}
                return httpx.Response(204)
            if key not in self.rows:
                return httpx.Response(404)
            return httpx.Response(200, json={**self.rows[key], **self.read_override})

        self.api = EditorialAPI("https://beta.invalid", "fixture-api", httpx.MockTransport(beta))
        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        self.addCleanup(sock.close)
        host = f"127.0.0.1:{sock.getsockname()[1]}"
        self.url = f"http://{host}/mcp"
        app = create_app("https://" + host, self.api, "fixture-connector")
        self.server = uvicorn.Server(uvicorn.Config(app, log_level="error", ws="none"))
        self.task = asyncio.create_task(self.server.serve(sockets=[sock]))
        async with asyncio.timeout(5):
            while not self.server.started:
                if self.task.done():
                    await self.task
                    self.fail("MCP process stopped before it listened")
                await asyncio.sleep(.01)
        self.client = httpx.AsyncClient(headers={"Authorization": "Bearer fixture-connector"}, trust_env=False)
        self.addAsyncCleanup(self.client.aclose)

    async def asyncTearDown(self):
        self.server.should_exit = True
        await asyncio.wait_for(self.task, 5)

    @asynccontextmanager
    async def session(self):
        async with streamable_http_client(self.url, http_client=self.client) as (reader, writer, _):
            async with ClientSession(reader, writer) as session:
                await session.initialize()
                yield session

    async def test_create_retry_correct_withdraw_and_read(self):
        key = "100oct/holiday-2026"
        args = {"story_id": key}
        async with self.session() as session:
            self.assertEqual({t.name for t in (await session.list_tools()).tools}, {"read_story", "put_story"})
            for rev in [1, 1, 2, 3]:
                payload = story(rev, withdrawn=rev == 3)
                written = await session.call_tool("put_story", {**args, "story": payload})
                self.assertFalse(written.isError, written.content)
                self.assertEqual(written.structuredContent["readBack"], {**payload, "story_id": key})
            read = await session.call_tool("read_story", args)
            self.assertTrue(read.structuredContent["withdrawn"])
            self.assertEqual(list(self.rows), [b"/v1/newswire/editorial/100oct%2Fholiday-2026"])
            self.assertEqual([r.method for r in self.requests], ["PUT", "GET"] * 4 + ["GET"])

    async def test_auth_origin_and_restricted_paths(self):
        for credential in [None, "fixture-api", "wrong"]:
            headers = {"Authorization": f"Bearer {credential}"} if credential else {}
            async with httpx.AsyncClient(trust_env=False) as bare:
                response = await bare.post(self.url, headers=headers, json={})
                self.assertEqual(response.status_code, 401)
        response = await self.client.post(self.url, headers={"Origin": "https://other.invalid",
            "Accept": "application/json, text/event-stream"}, json={"jsonrpc":"2.0","id":1,"method":"ping"})
        self.assertEqual(response.status_code, 403)
        async with self.session() as session:
            for key in ["../members", "a/../capture", "a%2fb", "a?token", "https://other.invalid"]:
                self.assertTrue((await session.call_tool("read_story", {"story_id": key})).isError)
            self.assertTrue((await session.call_tool("send_alert", {})).isError)
        self.assertFalse(self.requests)

    async def test_write_failure_unconfirmed_read_and_stale_retry(self):
        async with self.session() as session:
            args = {"story_id": "fixture-1"}
            self.redirect = True
            result = await session.call_tool("put_story", {**args, "story": story()})
            self.assertTrue(result.isError)
            self.assertIn("307", result.content[0].text)
            self.assertEqual(len(self.requests), 1)
            self.redirect = False
            self.read_failure = True
            result = await session.call_tool("put_story", {**args, "story": story(2)})
            self.assertTrue(result.isError)
            self.assertIn("accepted the write", result.content[0].text)
            self.read_failure = False
            read = await session.call_tool("read_story", args)
            self.assertEqual(read.structuredContent["verified_at"], story(2)["verified_at"])
            stale = await session.call_tool("put_story", {**args, "story": story(1)})
            self.assertTrue(stale.isError)
            self.assertIn("409", stale.content[0].text)

    async def test_body_and_readback_must_match_beta(self):
        async with self.session() as session:
            for edit in [{"status": "draft"}, {"source_url": "http://example.org"},
                         {"withdrawn": "false"}, {"verified_at": "2026-11-12"}]:
                response = await session.call_tool("put_story", {"story_id": "qa", "story": {**story(), **edit}})
                self.assertTrue(response.isError)
            self.assertFalse(self.requests)
            for override in [{"headline": "Newer revision"}, {"story_id": "another"}]:
                self.read_override = override
                response = await session.call_tool("put_story", {"story_id": "qa", "story": story()})
                self.assertTrue(response.isError)

    def test_deployment_settings(self):
        for url in ["http://remote.invalid", "https://user@beta.invalid", "https://beta.invalid/api",
                    "https://beta.invalid?key=1", "https://beta.invalid/#frag"]:
            with self.assertRaises(ValueError):
                origin(url, local_api=True)
        self.assertEqual(origin("http://127.0.0.1:8787", local_api=True), "http://127.0.0.1:8787")
        with self.assertRaises(ValueError):
            create_app("https://connector.invalid", self.api, "fixture-api")
