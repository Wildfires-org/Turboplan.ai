"""Unit tests for FileDownloadService."""

import socket
import threading
import time
from unittest.mock import Mock, patch

import pytest
import requests

from app.services.file_downloader import FileDownloadService, _is_public_ip
import ipaddress
from app.core.exceptions import InvalidURLError, FileSizeError, DownloadError


RESOLVER = "app.services.file_downloader.socket.getaddrinfo"
PUBLIC_IP_CHECK = "app.services.file_downloader._is_public_ip"


def _addrinfo(ips, port):
    """Build getaddrinfo-shaped tuples for the given IP strings."""
    entries = []
    for ip in ips:
        if ":" in ip:
            entries.append(
                (socket.AF_INET6, socket.SOCK_STREAM, 6, "", (ip, port, 0, 0))
            )
        else:
            entries.append((socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, port)))
    return entries


def _resolver(mapping, default=("93.184.216.34",)):
    """Fake DNS: maps hostname -> tuple of IPs, so tests never hit real DNS."""

    def _resolve(host, port, *_args, **_kwargs):
        ips = mapping.get(host, default)
        if ips is None:
            raise socket.gaierror("Name or service not known")
        return _addrinfo(ips, port)

    return _resolve


class _SlowDripServer:
    """
    A real HTTP origin that answers HEAD normally, then dribbles the body one
    byte at a time — far slower than `chunk_size` but comfortably inside the
    per-socket timeout, which is exactly the shape that used to hang the reader
    indefinitely.
    """

    def __init__(self, byte_interval=0.05, body_length=1_000_000):
        self.byte_interval = byte_interval
        self.body_length = body_length
        self._stop = threading.Event()
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._sock.bind(("127.0.0.1", 0))
        self._sock.listen(8)
        self.port = self._sock.getsockname()[1]
        self._thread = threading.Thread(target=self._serve, daemon=True)

    def __enter__(self):
        self._thread.start()
        return self

    def __exit__(self, *_exc):
        self._stop.set()
        try:
            self._sock.close()
        except OSError:
            pass
        self._thread.join(timeout=5)

    def _serve(self):
        while not self._stop.is_set():
            try:
                conn, _addr = self._sock.accept()
            except OSError:
                return
            threading.Thread(
                target=self._handle, args=(conn,), daemon=True
            ).start()

    def _handle(self, conn):
        try:
            request = b""
            while b"\r\n\r\n" not in request:
                data = conn.recv(4096)
                if not data:
                    return
                request += data

            method = request.split(b" ", 1)[0]
            headers = (
                "HTTP/1.1 200 OK\r\n"
                f"Content-Length: {self.body_length}\r\n"
                "Connection: close\r\n"
                "\r\n"
            ).encode()
            conn.sendall(headers)

            if method == b"HEAD":
                return

            # Drip forever (or until the client tears the socket down).
            while not self._stop.is_set():
                conn.sendall(b"x")
                time.sleep(self.byte_interval)
        except OSError:
            # Client aborted the connection — the expected end of this test.
            return
        finally:
            try:
                conn.close()
            except OSError:
                pass


def _head(status_code=200, headers=None):
    response = Mock()
    response.status_code = status_code
    response.headers = headers if headers is not None else {}
    return response


def _get(chunks):
    response = Mock()
    response.iter_content.return_value = chunks
    response.raise_for_status = Mock()
    return response


class TestPublicIPClassification:
    """The address classifier is the core of the SSRF guard."""

    @pytest.mark.parametrize(
        "address",
        [
            "100.64.0.1",  # CGNAT — private=False AND global=False
            "10.0.0.1",
            "127.0.0.1",
            "169.254.169.254",  # cloud metadata
            "0.0.0.0",
            "224.0.0.1",  # multicast reports is_global=True on some versions
            "240.0.0.1",
            "255.255.255.255",
            "::1",
            "::",
            "fc00::1",
            "fe80::1",
            "::ffff:10.0.0.1",  # IPv4-mapped private
            "::ffff:169.254.169.254",
            "64:ff9b::a00:1",  # NAT64 well-known prefix wrapping 10.0.0.1
            "::a00:1",  # IPv4-compatible ::10.0.0.1 — is_global says True
            "::7f00:1",  # IPv4-compatible ::127.0.0.1
            "::a9fe:a9fe",  # IPv4-compatible ::169.254.169.254 (metadata)
        ],
    )
    def test_non_public_addresses_rejected(self, address):
        assert _is_public_ip(ipaddress.ip_address(address)) is False

    @pytest.mark.parametrize("address", ["93.184.216.34", "2606:4700::1111"])
    def test_public_addresses_allowed(self, address):
        assert _is_public_ip(ipaddress.ip_address(address)) is True


class TestFileDownloadService:
    """Test suite for FileDownloadService."""

    def setup_method(self):
        """Set up test fixtures."""
        self.service = FileDownloadService(max_file_size=10 * 1024 * 1024)  # 10MB

    def test_invalid_url_format(self):
        """Test that invalid URLs raise InvalidURLError."""
        invalid_urls = [
            "not-a-url",
            "://missing-scheme.com",
            "http://",
            "",
            "ftp://ftp.example.com/file.zip",  # Non-HTTP scheme
            "https://user:pass@example.com/file.zip",  # userinfo smuggling
        ]

        for url in invalid_urls:
            with pytest.raises(InvalidURLError):
                self.service.download(url)

    @patch(RESOLVER)
    @patch("requests.Session.get")
    @patch("requests.Session.head")
    def test_successful_download(self, mock_head, mock_get, mock_resolve):
        """A single HEAD (from redirect resolution) feeds the size check."""
        mock_resolve.side_effect = _resolver({"example.com": ("93.184.216.34",)})
        mock_head.return_value = _head(headers={"content-length": "1024"})
        mock_get.return_value = _get([b"test", b"data"])

        result = self.service.download("https://example.com/file.zip")

        assert result == b"testdata"
        mock_head.assert_called_once()
        mock_get.assert_called_once()

    @patch(RESOLVER)
    @patch("requests.Session.get")
    @patch("requests.Session.head")
    def test_connection_is_pinned_to_validated_ip(self, mock_head, mock_get, mock_resolve):
        """Requests go to the checked IP, with the hostname kept for Host/TLS."""
        mock_resolve.side_effect = _resolver({"example.com": ("93.184.216.34",)})
        mock_head.return_value = _head(headers={"content-length": "4"})
        mock_get.return_value = _get([b"data"])

        self.service.download("https://example.com/file.zip")

        head_url = mock_head.call_args[0][0]
        get_url = mock_get.call_args[0][0]
        assert head_url == "https://93.184.216.34/file.zip"
        assert get_url == "https://93.184.216.34/file.zip"
        assert mock_head.call_args[1]["headers"]["Host"] == "example.com"
        assert mock_get.call_args[1]["headers"]["Host"] == "example.com"
        # Exactly one resolution for the single hop.
        assert mock_resolve.call_count == 1

    @patch(RESOLVER)
    @patch("requests.Session.head")
    def test_file_too_large_head_check(self, mock_head, mock_resolve):
        """Test that files exceeding size limit are rejected."""
        mock_resolve.side_effect = _resolver({})
        mock_head.return_value = _head(headers={"content-length": "20000000"})  # 20MB

        with pytest.raises(FileSizeError) as exc_info:
            self.service.download("https://example.com/large.zip")

        assert "File too large" in str(exc_info.value)
        assert "19.1MB" in str(exc_info.value)

    @patch(RESOLVER)
    @patch("requests.Session.get")
    @patch("requests.Session.head")
    def test_file_too_large_during_download(self, mock_head, mock_get, mock_resolve):
        """Test size check during download when content-length is missing."""
        mock_resolve.side_effect = _resolver({})
        mock_head.return_value = _head(headers={})
        large_chunk = b"x" * (6 * 1024 * 1024)  # 6MB chunks
        mock_get.return_value = _get([large_chunk, large_chunk])

        with pytest.raises(FileSizeError) as exc_info:
            self.service.download("https://example.com/sneaky-large.zip")

        assert "File too large during download" in str(exc_info.value)

    @patch(RESOLVER)
    @patch("requests.Session.get")
    @patch("requests.Session.head")
    def test_unparseable_content_length_falls_back_to_streaming_cap(
        self, mock_head, mock_get, mock_resolve
    ):
        """A junk Content-Length must not blow up; the streaming cap still holds."""
        mock_resolve.side_effect = _resolver({})
        mock_head.return_value = _head(headers={"content-length": "not-a-number"})
        large_chunk = b"x" * (6 * 1024 * 1024)
        mock_get.return_value = _get([large_chunk, large_chunk])

        with pytest.raises(FileSizeError) as exc_info:
            self.service.download("https://example.com/junk-length.zip")

        assert "File too large during download" in str(exc_info.value)

    @patch(RESOLVER)
    @patch("requests.Session.get")
    @patch("requests.Session.head")
    def test_redirect_on_get_after_clean_head_is_rejected(
        self, mock_head, mock_get, mock_resolve
    ):
        """HEAD 200 / GET 30x (method-differential server) must not yield an empty body."""
        mock_resolve.side_effect = _resolver({})
        mock_head.return_value = _head(headers={"content-length": "10"})
        get_response = _get([b"ignored"])
        get_response.status_code = 302
        get_response.headers = {"location": "http://10.0.0.5/"}
        mock_get.return_value = get_response

        with pytest.raises(InvalidURLError) as exc_info:
            self.service.download("https://example.com/file.zip")

        assert "Unexpected redirect" in str(exc_info.value)
        get_response.iter_content.assert_not_called()

    @patch(RESOLVER)
    @patch("requests.Session.get")
    @patch("requests.Session.head")
    def test_exhausted_budget_refuses_to_read(self, mock_head, mock_get, mock_resolve):
        """A budget already spent aborts before any body is consumed."""
        mock_resolve.side_effect = _resolver({})
        mock_head.return_value = _head(headers={})
        mock_get.return_value = _get([b"a", b"b", b"c"])
        self.service.max_download_seconds = -1  # deadline already in the past

        with pytest.raises(DownloadError) as exc_info:
            self.service.download("https://example.com/slow.zip")

        assert "timed out" in str(exc_info.value)

    def test_wall_clock_deadline_stops_slow_drip(self):
        """
        The regression this guards: `iter_content` only yields once a full
        chunk has arrived, and every dripped byte resets the per-socket
        timeout, so a between-chunk deadline check never runs. Against a real
        origin dripping one byte at a time, the download must still be cut at
        the wall-clock budget rather than blocking for hours.

        No mocked `iter_content` here — the read path, the socket and the
        timeout are all real.
        """
        with _SlowDripServer() as server:
            self.service.max_download_seconds = 1
            # Left at the production value on purpose: the per-recv timeout is
            # never what saves us, since bytes keep arriving inside it.
            assert self.service.timeout_download == 30
            # A full chunk would need ~8192 * 0.05s ≈ 7 minutes to arrive.
            assert self.service.chunk_size == 8192

            # Patching the resolver also intercepts urllib3's own
            # create_connection lookup for the pinned literal, so loopback has
            # to be the default too or the real connect never happens.
            resolve = _resolver(
                {"drip.test": ("127.0.0.1",)}, default=("127.0.0.1",)
            )
            started = time.monotonic()
            with patch(RESOLVER, side_effect=resolve), \
                    patch(PUBLIC_IP_CHECK, return_value=True):
                with pytest.raises(DownloadError) as exc_info:
                    self.service.download(
                        f"http://drip.test:{server.port}/slow.zip"
                    )
            elapsed = time.monotonic() - started

        assert "timed out" in str(exc_info.value)
        # Cut at the budget, not at the per-recv timeout and not at the point
        # where a whole 8KB chunk would finally have arrived.
        assert elapsed < 10, f"deadline not enforced promptly ({elapsed:.1f}s)"

    def test_aborted_download_does_not_leak_its_reader_thread(self):
        """
        The reader runs on a worker thread, so a timeout that merely returned
        would leave that thread parked in recv() for the life of the process.
        The connection is torn down on the way out so the worker dies with it.
        """
        with _SlowDripServer() as server:
            self.service.max_download_seconds = 1
            # Patching the resolver also intercepts urllib3's own
            # create_connection lookup for the pinned literal, so loopback has
            # to be the default too or the real connect never happens.
            resolve = _resolver(
                {"drip.test": ("127.0.0.1",)}, default=("127.0.0.1",)
            )
            with patch(RESOLVER, side_effect=resolve), \
                    patch(PUBLIC_IP_CHECK, return_value=True):
                with pytest.raises(DownloadError):
                    self.service.download(
                        f"http://drip.test:{server.port}/slow.zip"
                    )

            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                if not self._download_threads():
                    break
                time.sleep(0.05)

            assert self._download_threads() == [], "reader thread outlived the abort"

    @staticmethod
    def _download_threads():
        return [
            t.name
            for t in threading.enumerate()
            if t.name.startswith("gis-download") and t.is_alive()
        ]

    @patch(RESOLVER)
    @patch("requests.Session.get")
    @patch("requests.Session.head")
    def test_empty_file_error(self, mock_head, mock_get, mock_resolve):
        """Test that empty files raise DownloadError."""
        mock_resolve.side_effect = _resolver({})
        mock_head.return_value = _head(headers={"content-length": "0"})
        mock_get.return_value = _get([])

        with pytest.raises(DownloadError) as exc_info:
            self.service.download("https://example.com/empty.zip")

        assert "Empty file downloaded" in str(exc_info.value)

    @patch(RESOLVER)
    @patch("requests.Session.head")
    def test_request_exception_is_not_relayed(self, mock_head, mock_resolve):
        """Network error details must not leak back to the caller."""
        mock_resolve.side_effect = _resolver({})
        mock_head.side_effect = requests.RequestException(
            "HTTPSConnectionPool(host='10.0.0.5', port=8080): Connection refused"
        )

        with pytest.raises(DownloadError) as exc_info:
            self.service.download("https://example.com/file.zip")

        message = str(exc_info.value)
        assert message == "Download failed"
        assert "10.0.0.5" not in message
        assert "refused" not in message

    @patch(RESOLVER)
    @patch("requests.Session.head")
    def test_private_ipv4_host_rejected(self, mock_head, mock_resolve):
        mock_resolve.side_effect = _resolver({"internal.test": ("10.0.0.1",)})

        with pytest.raises(InvalidURLError):
            self.service.download("https://internal.test/file.zip")

        mock_head.assert_not_called()

    @patch(RESOLVER)
    @patch("requests.Session.head")
    def test_cgnat_host_rejected(self, mock_head, mock_resolve):
        mock_resolve.side_effect = _resolver({"cgnat.test": ("100.64.0.1",)})

        with pytest.raises(InvalidURLError):
            self.service.download("https://cgnat.test/file.zip")

        mock_head.assert_not_called()

    @patch(RESOLVER)
    @patch("requests.Session.head")
    def test_ipv4_mapped_ipv6_private_rejected(self, mock_head, mock_resolve):
        mock_resolve.side_effect = _resolver({"mapped.test": ("::ffff:169.254.169.254",)})

        with pytest.raises(InvalidURLError):
            self.service.download("https://mapped.test/file.zip")

        mock_head.assert_not_called()

    @patch(RESOLVER)
    @patch("requests.Session.head")
    def test_multiple_records_with_one_private_rejected(self, mock_head, mock_resolve):
        """All resolved addresses must be public, not just the first one."""
        mock_resolve.side_effect = _resolver(
            {"mixed.test": ("93.184.216.34", "10.0.0.7")}
        )

        with pytest.raises(InvalidURLError):
            self.service.download("https://mixed.test/file.zip")

        mock_head.assert_not_called()

    @patch(RESOLVER)
    @patch("requests.Session.head")
    def test_redirect_to_private_host_rejected(self, mock_head, mock_resolve):
        mock_resolve.side_effect = _resolver(
            {"example.com": ("93.184.216.34",), "internal.test": ("169.254.169.254",)}
        )
        mock_head.return_value = _head(
            status_code=302, headers={"location": "https://internal.test/secret"}
        )

        with pytest.raises(InvalidURLError):
            self.service.download("https://example.com/file.zip")

        assert mock_head.call_count == 1

    @patch(RESOLVER)
    @patch("requests.Session.head")
    def test_https_to_http_downgrade_rejected(self, mock_head, mock_resolve):
        mock_resolve.side_effect = _resolver({"example.com": ("93.184.216.34",)})
        mock_head.return_value = _head(
            status_code=302, headers={"location": "http://example.com/file.zip"}
        )

        with pytest.raises(InvalidURLError) as exc_info:
            self.service.download("https://example.com/file.zip")

        assert "downgrade" in str(exc_info.value).lower()

    @patch(RESOLVER)
    @patch("requests.Session.head")
    def test_redirect_with_userinfo_rejected(self, mock_head, mock_resolve):
        mock_resolve.side_effect = _resolver({"example.com": ("93.184.216.34",)})
        mock_head.return_value = _head(
            status_code=302,
            headers={"location": "https://user:pass@example.com/file.zip"},
        )

        with pytest.raises(InvalidURLError) as exc_info:
            self.service.download("https://example.com/file.zip")

        assert "credentials" in str(exc_info.value).lower()

    @patch(RESOLVER)
    @patch("requests.Session.head")
    def test_redirect_cap_enforced(self, mock_head, mock_resolve):
        """An endless redirect chain is cut off rather than followed."""
        mock_resolve.side_effect = _resolver({})
        mock_head.side_effect = [
            _head(status_code=302, headers={"location": f"https://example.com/hop{i}"})
            for i in range(10)
        ]

        with pytest.raises(InvalidURLError) as exc_info:
            self.service.download("https://example.com/file.zip")

        assert "Too many redirects" in str(exc_info.value)
        assert mock_head.call_count == 4  # MAX_REDIRECTS + 1

    @patch(RESOLVER)
    @patch("requests.Session.get")
    @patch("requests.Session.head")
    def test_redirect_to_public_host_followed_and_repinned(
        self, mock_head, mock_get, mock_resolve
    ):
        """Each hop is resolved once and pinned to its own validated IP."""
        mock_resolve.side_effect = _resolver(
            {"example.com": ("93.184.216.34",), "cdn.test": ("93.184.216.35",)}
        )
        mock_head.side_effect = [
            _head(status_code=302, headers={"location": "https://cdn.test/file.zip"}),
            _head(headers={"content-length": "4"}),
        ]
        mock_get.return_value = _get([b"data"])

        assert self.service.download("https://example.com/file.zip") == b"data"

        assert mock_head.call_count == 2
        assert mock_resolve.call_count == 2  # exactly one lookup per hop
        assert mock_get.call_args[0][0] == "https://93.184.216.35/file.zip"
        assert mock_get.call_args[1]["headers"]["Host"] == "cdn.test"
