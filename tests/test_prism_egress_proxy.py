"""Tests of scripts/prism_egress_proxy.py against loopback sockets only.

They show that the proxy tunnels to an exactly allowlisted host on the one
permitted port, refuses and logs everything else, and will not start open.
They do not show that a container on an internal Docker network can reach
nothing else: that is a property of the runner's network, checked on the
runner by the egress control in scripts/prism_native_gate.sh.
"""
from pathlib import Path
import asyncio
import importlib.util
import socket
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "prism_egress_proxy.py"
spec = importlib.util.spec_from_file_location("prism_egress_proxy", SCRIPT)
proxy_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proxy_module)


class AllowlistValidationTests(unittest.TestCase):
    def test_exact_lowercase_names_are_accepted(self):
        allow = proxy_module.validate_allowlist(["static.crates.io", "github.com"])
        self.assertEqual(allow, frozenset({"static.crates.io", "github.com"}))

    def test_an_empty_allowlist_is_refused(self):
        with self.assertRaises(ValueError):
            proxy_module.validate_allowlist([])

    def test_wildcards_addresses_ports_schemes_and_case_are_refused(self):
        for bad in ("*.crates.io", ".crates.io", "140.82.112.3", "github.com:443", "https://github.com",
                    "GitHub.com", "github.com/RustSec", "localhost", "", "crates..io", "-a.io"):
            with self.subTest(entry=bad):
                with self.assertRaises(ValueError):
                    proxy_module.validate_allowlist([bad])

    def test_the_command_line_refuses_to_bind_every_interface_or_start_open(self):
        for argv in (
            ["--listen", "0.0.0.0:3128", "--log", "/dev/null", "--allow", "github.com"],
            ["--listen", "127.0.0.1:3128", "--log", "/dev/null"],
            ["--listen", "localhost:3128", "--log", "/dev/null", "--allow", "github.com"],
        ):
            with self.subTest(argv=argv):
                with self.assertRaises(SystemExit) as raised:
                    proxy_module.main(argv)
                self.assertEqual(raised.exception.code, 2)


class ProxyBehaviourTests(unittest.TestCase):
    """`localhost.test` stands in for an allowlisted host; the upstream is a loopback echo server."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.log = Path(self.tmp.name) / "egress.log"

        self.upstream = socket.socket()
        self.upstream.bind(("127.0.0.1", 0))
        self.upstream.listen(4)
        self.upstream_port = self.upstream.getsockname()[1]
        self.addCleanup(self.upstream.close)
        threading.Thread(target=self.echo_forever, daemon=True).start()

        self.loop = asyncio.new_event_loop()
        ready = self.loop.create_future()
        original = asyncio.open_connection

        async def loopback_only(host, port, *args, **kwargs):
            # Name resolution is replaced, never the allow decision: only a name
            # the proxy already allowed reaches this point.
            self.connected.append((host, port))
            return await original("127.0.0.1", port, *args, **kwargs)

        self.connected = []
        proxy_module.asyncio.open_connection = loopback_only
        self.addCleanup(setattr, proxy_module.asyncio, "open_connection", original)
        self.task = self.loop.create_task(
            proxy_module.serve("127.0.0.1", 0, frozenset({"allowed.example.org"}), str(self.log),
                               port=self.upstream_port, ready=ready)
        )
        self.thread = threading.Thread(target=self.loop.run_forever, daemon=True)
        self.thread.start()
        self.port = asyncio.run_coroutine_threadsafe(self.wait(ready), self.loop).result(timeout=5)
        self.addCleanup(self.stop)

    @staticmethod
    async def wait(future):
        return await future

    def stop(self):
        self.loop.call_soon_threadsafe(self.task.cancel)
        self.loop.call_soon_threadsafe(self.loop.stop)
        self.thread.join(timeout=5)

    def echo_forever(self):
        while True:
            try:
                connection, _ = self.upstream.accept()
            except OSError:
                return
            with connection:
                data = connection.recv(1024)
                connection.sendall(b"echo:" + data)

    def request(self, head: bytes, then: bytes = b"") -> bytes:
        with socket.create_connection(("127.0.0.1", self.port), timeout=5) as client:
            client.sendall(head)
            reply = client.recv(1024)
            if then and b" 200 " in reply:
                client.sendall(then)
                reply += client.recv(1024)
            return reply

    def log_lines(self):
        return [line.split(" ", 1)[1] for line in self.log.read_text().splitlines()]

    def test_an_allowlisted_host_on_the_permitted_port_is_tunnelled_and_logged(self):
        target = f"allowed.example.org:{self.upstream_port}".encode()
        reply = self.request(b"CONNECT " + target + b" HTTP/1.1\r\nHost: " + target + b"\r\n\r\n", b"ping")
        self.assertIn(b"200 Connection Established", reply)
        self.assertIn(b"echo:ping", reply)
        self.assertEqual(self.connected, [("allowed.example.org", self.upstream_port)])
        self.assertIn(f"ALLOW allowed.example.org:{self.upstream_port}", self.log_lines())

    def test_a_host_that_is_not_allowlisted_is_refused_and_logged_without_connecting(self):
        for host in ("example.com", "evil.allowed.example.org", "allowed.example.org.evil.test", "169.254.169.254"):
            with self.subTest(host=host):
                target = f"{host}:{self.upstream_port}".encode()
                reply = self.request(b"CONNECT " + target + b" HTTP/1.1\r\n\r\n")
                self.assertIn(b" 403 ", reply)
                self.assertIn(f"DENY {host}:{self.upstream_port} not-on-allowlist", self.log_lines())
        self.assertEqual(self.connected, [])

    def test_an_allowlisted_host_on_another_port_is_refused(self):
        reply = self.request(b"CONNECT allowed.example.org:22 HTTP/1.1\r\n\r\n")
        self.assertIn(b" 403 ", reply)
        self.assertIn("DENY allowed.example.org:22 not-on-allowlist", self.log_lines())
        self.assertEqual(self.connected, [])

    def test_the_host_comparison_ignores_case_but_never_widens(self):
        target = f"ALLOWED.Example.ORG:{self.upstream_port}".encode()
        reply = self.request(b"CONNECT " + target + b" HTTP/1.1\r\n\r\n", b"x")
        self.assertIn(b" 200 ", reply)
        self.assertEqual(self.connected, [("allowed.example.org", self.upstream_port)])

    def test_plain_http_and_other_methods_are_never_forwarded(self):
        for head in (
            b"GET http://allowed.example.org/ HTTP/1.1\r\nHost: allowed.example.org\r\n\r\n",
            b"POST http://allowed.example.org/x HTTP/1.1\r\n\r\n",
            b"CONNECT allowed.example.org HTTP/1.1\r\n\r\n",
            b"CONNECT allowed.example.org:443 extra HTTP/1.1\r\n\r\n",
        ):
            with self.subTest(head=head[:40]):
                self.assertIn(b" 405 ", self.request(head))
        self.assertEqual(self.connected, [])
        self.assertEqual(sum("not-a-connect" in line for line in self.log_lines()), 4)

    def test_a_probe_that_sends_nothing_is_logged_as_closed_and_a_partial_request_as_denied(self):
        with socket.create_connection(("127.0.0.1", self.port), timeout=5):
            pass
        with socket.create_connection(("127.0.0.1", self.port), timeout=5) as client:
            client.sendall(b"CONNECT allowed.example.org:443 HTT")
        for _ in range(50):
            if len(self.log_lines()) >= 3:
                break
            threading.Event().wait(0.05)
        self.assertIn("CLOSED - no-request", self.log_lines())
        self.assertIn("DENY - unreadable-request", self.log_lines())
        self.assertEqual(self.connected, [])

    def test_the_log_opens_with_the_address_and_the_sorted_allowlist(self):
        self.assertEqual(self.log_lines()[0], f"START 127.0.0.1:{self.port} allow=allowed.example.org")


if __name__ == "__main__":
    unittest.main()
