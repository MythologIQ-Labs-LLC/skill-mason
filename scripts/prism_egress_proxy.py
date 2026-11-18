#!/usr/bin/env python3
"""Allowlisting CONNECT proxy for the Prism SDK gate's network egress (issue #9).

The SDK container is attached to an internal Docker network that has no route
out. This proxy, running on the disposable runner, is the only way out of that
network. It tunnels a TLS connection to an exactly named host on port 443 and
refuses everything else. Every request is written to the log, allowed or not,
so a gate run's network destinations are a recorded fact rather than a guess.

It does not terminate TLS, read tunnelled bytes or cache anything. It is not a
gate: it adds no check to `just vv` and skips none.

usage: prism_egress_proxy.py --listen IP:PORT --log FILE --allow HOST [--allow HOST ...]
"""
from __future__ import annotations

import argparse
import asyncio
import datetime
import re
import sys

HOSTNAME = re.compile(r"^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$")
REQUEST_LINE = re.compile(rb"^CONNECT ([A-Za-z0-9.-]{1,253}):([0-9]{1,5}) HTTP/1\.[01]$")
MAX_HEAD = 8192
TLS_PORT = 443


def validate_allowlist(hosts: list[str]) -> frozenset[str]:
    """Exact lowercase DNS names only: no wildcard, address, scheme, port or path."""
    if not hosts:
        raise ValueError("the allowlist is empty; an open proxy is refused")
    for host in hosts:
        if not HOSTNAME.match(host) or re.fullmatch(r"[0-9.]+", host):
            raise ValueError(f"not an exact lowercase DNS name: {host!r}")
    return frozenset(hosts)


class EgressProxy:
    def __init__(self, allow: frozenset[str], log_path: str, port: int = TLS_PORT):
        self.allow = allow
        self.port = port
        self.log = open(log_path, "a", encoding="utf-8", buffering=1)

    def record(self, verdict: str, target: str, detail: str = "") -> None:
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        self.log.write(" ".join(part for part in (stamp, verdict, target, detail) if part) + "\n")

    async def handle(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        try:
            head = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), timeout=30)
        except asyncio.IncompleteReadError as error:
            # Nothing was asked for: a port probe that connected and hung up.
            self.record("DENY" if error.partial else "CLOSED", "-", "unreadable-request" if error.partial else "no-request")
            await self.close(writer)
            return
        except (asyncio.LimitOverrunError, asyncio.TimeoutError, ConnectionError):
            self.record("DENY", "-", "unreadable-request")
            await self.close(writer)
            return
        line = head.split(b"\r\n", 1)[0]
        match = REQUEST_LINE.match(line)
        if not match:
            # Plain HTTP, another method, or a malformed target. Never forwarded.
            shown = line[:120].decode("ascii", "replace").replace(" ", "_")
            self.record("DENY", "-", f"not-a-connect:{shown}")
            await self.reply(writer, b"405 Method Not Allowed")
            return
        host = match.group(1).decode("ascii").lower()
        port = int(match.group(2))
        target = f"{host}:{port}"
        if host not in self.allow or port != self.port:
            self.record("DENY", target, "not-on-allowlist")
            await self.reply(writer, b"403 Forbidden")
            return
        try:
            upstream_reader, upstream_writer = await asyncio.wait_for(
                asyncio.open_connection(host, port), timeout=30
            )
        except (OSError, asyncio.TimeoutError) as error:
            self.record("ERROR", target, f"upstream:{type(error).__name__}")
            await self.reply(writer, b"502 Bad Gateway")
            return
        self.record("ALLOW", target)
        writer.write(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        await writer.drain()
        await asyncio.gather(
            self.pipe(reader, upstream_writer), self.pipe(upstream_reader, writer)
        )

    @staticmethod
    async def pipe(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        try:
            while chunk := await reader.read(65536):
                writer.write(chunk)
                await writer.drain()
        except (ConnectionError, OSError):
            pass
        finally:
            await EgressProxy.close(writer)

    @staticmethod
    async def reply(writer: asyncio.StreamWriter, status: bytes) -> None:
        try:
            writer.write(b"HTTP/1.1 " + status + b"\r\nConnection: close\r\nContent-Length: 0\r\n\r\n")
            await writer.drain()
        except (ConnectionError, OSError):
            pass
        await EgressProxy.close(writer)

    @staticmethod
    async def close(writer: asyncio.StreamWriter) -> None:
        try:
            writer.close()
            await writer.wait_closed()
        except (ConnectionError, OSError):
            pass


async def serve(listen_host: str, listen_port: int, allow: frozenset[str], log_path: str,
                port: int = TLS_PORT, ready: asyncio.Future | None = None) -> None:
    proxy = EgressProxy(allow, log_path, port)
    server = await asyncio.start_server(proxy.handle, listen_host, listen_port, limit=MAX_HEAD)
    bound = server.sockets[0].getsockname()
    proxy.record("START", f"{bound[0]}:{bound[1]}", "allow=" + ",".join(sorted(allow)))
    if ready is not None:
        ready.set_result(bound[1])
    async with server:
        await server.serve_forever()


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--listen", required=True, help="IPv4 address and port to bind, e.g. 172.30.99.1:3128")
    parser.add_argument("--log", required=True, help="file every request is appended to")
    parser.add_argument("--allow", action="append", default=[], help="exact host allowed on port 443; repeatable")
    args = parser.parse_args(argv)
    listen = re.fullmatch(r"((?:[0-9]{1,3}\.){3}[0-9]{1,3}):([0-9]{1,5})", args.listen)
    if not listen:
        parser.error("--listen must be IPv4:PORT")
    if listen.group(1) == "0.0.0.0":
        parser.error("--listen must name one address; binding every interface is refused")
    try:
        allow = validate_allowlist(args.allow)
    except ValueError as error:
        parser.error(str(error))
    try:
        asyncio.run(serve(listen.group(1), int(listen.group(2)), allow, args.log))
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
