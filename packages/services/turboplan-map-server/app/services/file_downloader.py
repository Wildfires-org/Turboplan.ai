"""File download service for handling URL downloads with validation."""

import ipaddress
import logging
import socket
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from typing import Dict, List, Optional, Tuple, Union
from urllib.parse import urljoin, urlparse, urlunparse

import requests
from requests.adapters import DEFAULT_POOLBLOCK, HTTPAdapter

from app.core.exceptions import InvalidURLError, FileSizeError, DownloadError


logger = logging.getLogger(__name__)


# Maximum number of redirects to follow, each re-validated against SSRF rules.
MAX_REDIRECTS = 3

# RFC 6052 well-known NAT64 prefix. It embeds an IPv4 address in its low 32 bits
# yet reports is_global=True, so a NAT64 gateway on the path would translate
# 64:ff9b::a00:1 into a connection to 10.0.0.1. Unwrap it like ::ffff:0:0/96.
_NAT64_PREFIX = ipaddress.IPv6Network('64:ff9b::/96')

# Deprecated IPv4-compatible IPv6 (RFC 4291 §2.5.5.1): ::a.b.c.d, which Python
# renders as ::a00:1 for ::10.0.0.1. `ipaddress` exposes no `ipv4_compatible`
# helper and reports is_global=True for these, so ::a00:1 and ::7f00:1 sail
# past an is_global check while a dual-stack host happily connects them to
# 10.0.0.1 / 127.0.0.1. Unwrap them like the mapped and NAT64 forms.
_V4_COMPATIBLE_PREFIX = ipaddress.IPv6Network('::/96')

# Deliberately vague and identical for DNS failures, non-global addresses and
# malformed hosts, so the endpoint cannot be used as a DNS-existence or
# internal-network oracle.
_HOST_REJECTED = 'URL host is not allowed'

_REDIRECT_STATUSES = (301, 302, 303, 307, 308)

_IPAddress = Union[ipaddress.IPv4Address, ipaddress.IPv6Address]


def _unwrap_ip(ip: _IPAddress) -> _IPAddress:
    """Return the effective IPv4 address behind v4-mapped / NAT64 IPv6 forms."""
    mapped = getattr(ip, 'ipv4_mapped', None)
    if mapped is not None:
        return mapped
    if not isinstance(ip, ipaddress.IPv6Address):
        return ip
    if ip in _NAT64_PREFIX:
        return ipaddress.IPv4Address(int(ip) & 0xFFFFFFFF)
    # `::` (unspecified) and `::1` (loopback) live in ::/96 but are not
    # embedded IPv4 addresses; leave them to is_global, which already rejects
    # both.
    if ip in _V4_COMPATIBLE_PREFIX and int(ip) > 1:
        return ipaddress.IPv4Address(int(ip) & 0xFFFFFFFF)
    return ip


def _is_public_ip(ip: _IPAddress) -> bool:
    """
    True only for globally routable unicast addresses.

    `is_global` is the authoritative test: unlike an OR-chain of is_private /
    is_loopback / is_link_local / is_reserved it also rejects ranges that are
    neither private nor global, such as CGNAT 100.64.0.0/10. Multicast is
    checked explicitly because some Python versions report is_global=True for
    globally-scoped multicast (e.g. 224.0.0.1).
    """
    effective = _unwrap_ip(ip)
    return effective.is_global and not effective.is_multicast


def _response_socket(response: requests.Response) -> Optional[socket.socket]:
    """
    Dig out the socket under a streaming response, or None if it has moved.

    There is no public accessor for this. `raw._connection.sock` is the
    documented-ish shape and is populated on some urllib3 versions; on urllib3
    2.x it reads back as None once the response is streaming, and the live
    socket is the one `http.client` wrapped in its buffered reader. Try both,
    tolerate either being absent.
    """
    raw = getattr(response, 'raw', None)
    connection = getattr(raw, '_connection', None) or getattr(raw, 'connection', None)
    sock = getattr(connection, 'sock', None)
    if sock is not None:
        return sock

    # raw._fp is the http.client.HTTPResponse; .fp its BufferedReader over a
    # SocketIO, whose ._sock still holds a live fd even though the wrapper
    # reports itself closed after makefile() detached it.
    node = raw
    for attr in ('_fp', 'fp', 'raw', '_sock'):
        node = getattr(node, attr, None)
        if node is None:
            return None
    return node


def _abort_response(response: requests.Response) -> None:
    """
    Interrupt a reader parked in `recv()` on this response.

    Only `shutdown()` does that: it breaks the connection in both directions
    immediately, so the abandoned worker's next read fails instead of waiting
    out a drip that may never end.

    `response.close()` is deliberately NOT called here. Closing a streaming
    response takes the lock on the buffered reader that the worker thread is
    still holding, so the aborting thread would block until the very read it is
    trying to escape completes — turning a leaked thread into a deadlocked
    request. The worker unwinds on its own once the socket is torn down, and
    `download()` closes the session in its `finally`.
    """
    sock = _response_socket(response)
    if sock is None:
        logger.warning('Could not reach socket to abort a timed-out download')
        return
    try:
        sock.shutdown(socket.SHUT_RDWR)
    except OSError:
        logger.debug('Socket shutdown on aborted download failed', exc_info=True)


def _host_literal(ip: _IPAddress) -> str:
    """Render an address for use inside a URL netloc."""
    if ip.version == 6:
        return '[{}]'.format(ip)
    return str(ip)


class _PinnedHostAdapter(HTTPAdapter):
    """
    Connects to a pre-validated IP literal while still presenting the original
    hostname for SNI and certificate verification.

    `server_hostname` drives the TLS SNI extension; `assert_hostname` makes
    urllib3 match the peer certificate against the real hostname instead of the
    IP we dialled. Both are stripped by urllib3 for plain-HTTP pools, so they
    are only injected when the hop is TLS.
    """

    def __init__(self, hostname: str, use_tls: bool, **kwargs):
        self._pinned_hostname = hostname
        self._use_tls = use_tls
        super().__init__(**kwargs)

    def _with_pin(self, pool_kwargs: dict) -> dict:
        if not self._use_tls:
            return pool_kwargs
        pinned = dict(pool_kwargs)
        pinned['server_hostname'] = self._pinned_hostname
        pinned['assert_hostname'] = self._pinned_hostname
        return pinned

    def init_poolmanager(self, connections, maxsize, block=DEFAULT_POOLBLOCK, **pool_kwargs):
        super().init_poolmanager(
            connections, maxsize, block, **self._with_pin(pool_kwargs)
        )

    def proxy_manager_for(self, proxy, **proxy_kwargs):
        return super().proxy_manager_for(proxy, **self._with_pin(proxy_kwargs))


class _PinnedTarget:
    """One validated hop: a session pinned to the IP we resolved and checked."""

    __slots__ = ('session', 'url', 'headers', 'response')

    def __init__(
        self,
        session: requests.Session,
        url: str,
        headers: Dict[str, str],
        response: requests.Response,
    ):
        self.session = session
        self.url = url
        self.headers = headers
        self.response = response

    def close(self) -> None:
        self.session.close()


class FileDownloadService:
    """Service responsible for downloading files from URLs with validation and size limits."""

    def __init__(self, max_file_size: int = 100 * 1024 * 1024):
        """
        Initialize the file download service.

        Args:
            max_file_size: Maximum file size in bytes (default 100MB)
        """
        self.max_file_size = max_file_size
        self.timeout_head = 10
        # Per-socket-operation timeout (requests semantics). A server that
        # trickles one byte every 29s never trips it, so the streaming loop also
        # enforces the wall-clock budget below.
        self.timeout_download = 30
        self.max_download_seconds = 120
        self.chunk_size = 8192

    def download(self, url: str) -> bytes:
        """
        Download file from URL with validation and size limits.

        Args:
            url: URL to download from

        Returns:
            Downloaded file data as bytes

        Raises:
            InvalidURLError: URL is malformed or resolves to a non-public host
            FileSizeError: File exceeds the configured size limit
            DownloadError: Download failed
        """
        headers = {'User-Agent': 'Mozilla/5.0 (compatible; GIS-Parser/1.0)'}
        target = None

        try:
            # Follow redirects manually, re-validating every hop against the
            # SSRF rules, so a public URL cannot 30x-redirect to a private host.
            # The HEAD response of the final hop is reused for the size check.
            target = self._resolve_safe_target(url, headers)
            self._check_file_size(target.response)
            return self._download_file(target)
        except requests.RequestException as e:
            # The exception text carries the host, port and failure mode
            # (refused vs. timeout vs. TLS error), which turns the endpoint into
            # a port scanner. Log it server-side, return a fixed message.
            logger.warning('Download failed', exc_info=True)
            raise DownloadError('Download failed') from e
        finally:
            if target is not None:
                target.close()

    def _parse_url(self, url: str) -> Tuple[str, str, int]:
        """Validate URL shape and scheme; return (scheme, hostname, port)."""
        parsed = urlparse(url)

        if not parsed.scheme or not parsed.netloc:
            raise InvalidURLError('Invalid URL format')

        if parsed.scheme not in ('http', 'https'):
            raise InvalidURLError('Only HTTP and HTTPS URLs are allowed')

        # Credentials in the URL are never needed here and are a classic way to
        # smuggle a different authority past naive parsers.
        if parsed.username or parsed.password:
            raise InvalidURLError('URL credentials are not allowed')

        hostname = parsed.hostname
        if not hostname:
            raise InvalidURLError('Invalid URL host')

        try:
            port = parsed.port
        except ValueError as e:
            raise InvalidURLError('Invalid URL port') from e

        if port is None:
            port = 443 if parsed.scheme == 'https' else 80

        return parsed.scheme, hostname, port

    def _resolve_public_addresses(self, hostname: str, port: int) -> List[_IPAddress]:
        """
        Resolve the hostname exactly once and require every returned address to
        be globally routable. The caller connects to one of these addresses
        directly, so this single lookup feeds both the check and the connection
        — there is no second resolution for a DNS-rebinding attacker to win.
        """
        try:
            addrinfos = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
        except socket.gaierror as e:
            logger.warning('DNS resolution failed for %s', hostname, exc_info=True)
            raise InvalidURLError(_HOST_REJECTED) from e

        if not addrinfos:
            raise InvalidURLError(_HOST_REJECTED)

        addresses = []
        for _family, _type, _proto, _canonname, sockaddr in addrinfos:
            try:
                ip = ipaddress.ip_address(sockaddr[0])
            except ValueError as e:
                raise InvalidURLError(_HOST_REJECTED) from e
            if not _is_public_ip(ip):
                logger.warning('Rejected non-public address for host %s', hostname)
                raise InvalidURLError(_HOST_REJECTED)
            addresses.append(ip)

        return addresses

    def _open_hop(self, url: str, headers: Dict[str, str]) -> _PinnedTarget:
        """Validate, resolve once, and issue a HEAD pinned to the checked IP."""
        scheme, hostname, port = self._parse_url(url)
        addresses = self._resolve_public_addresses(hostname, port)

        parsed = urlparse(url)
        pinned_netloc = _host_literal(addresses[0])
        host_header = hostname
        if parsed.port is not None:
            pinned_netloc = '{}:{}'.format(pinned_netloc, parsed.port)
            host_header = '{}:{}'.format(hostname, parsed.port)
        pinned_url = urlunparse(parsed._replace(netloc=pinned_netloc))

        hop_headers = dict(headers)
        hop_headers['Host'] = host_header

        session = requests.Session()
        # Proxies would terminate the connection somewhere else entirely and
        # defeat the IP pin, so environment proxy/netrc config is ignored.
        session.trust_env = False
        adapter = _PinnedHostAdapter(hostname, use_tls=(scheme == 'https'))
        session.mount('http://', adapter)
        session.mount('https://', adapter)

        try:
            response = session.head(
                pinned_url,
                headers=hop_headers,
                timeout=self.timeout_head,
                allow_redirects=False,
            )
        except BaseException:
            session.close()
            raise

        return _PinnedTarget(session, pinned_url, hop_headers, response)

    def _resolve_safe_target(self, url: str, headers: Dict[str, str]) -> _PinnedTarget:
        """
        Walk redirects manually (no auto-redirect), validating and pinning each
        hop, and return the final non-redirect hop with its HEAD response.
        """
        current_url = url
        for _hop in range(MAX_REDIRECTS + 1):
            target = self._open_hop(current_url, headers)

            if target.response.status_code not in _REDIRECT_STATUSES:
                return target

            location = target.response.headers.get('location')
            if not location:
                return target

            next_url = urljoin(current_url, location)
            target.close()
            self._validate_redirect(current_url, next_url)
            current_url = next_url

        raise InvalidURLError('Too many redirects')

    def _validate_redirect(self, current_url: str, next_url: str) -> None:
        """Reject protocol downgrades and credential-bearing redirect targets."""
        current = urlparse(current_url)
        nxt = urlparse(next_url)

        if current.scheme == 'https' and nxt.scheme != 'https':
            raise InvalidURLError('Redirect downgrades HTTPS to HTTP')

        if nxt.username or nxt.password:
            raise InvalidURLError('URL credentials are not allowed')

    def _check_file_size(self, head_response: requests.Response) -> None:
        """Check advertised size from the HEAD already issued for the final hop."""
        content_length = self._parse_content_length(head_response)
        if content_length is None:
            return

        if content_length > self.max_file_size:
            raise FileSizeError(
                f'File too large: {content_length / (1024 * 1024):.1f}MB '
                f'(max: {self.max_file_size / (1024 * 1024)}MB)'
            )

    @staticmethod
    def _parse_content_length(response: requests.Response) -> Optional[int]:
        """Content-Length as an int, or None when absent or unparseable."""
        raw = response.headers.get('content-length')
        if not raw:
            return None
        try:
            return int(raw)
        except (TypeError, ValueError):
            # Unknown size — the streaming cap in _download_file still applies.
            logger.warning('Ignoring unparseable content-length header')
            return None

    def _download_file(self, target: _PinnedTarget) -> bytes:
        """Download file content with streaming and size validation."""
        response = target.session.get(
            target.url,
            headers=target.headers,
            timeout=self.timeout_download,
            stream=True,
            allow_redirects=False,
        )
        # HEAD was already validated as non-redirect; a server that answers
        # HEAD 200 but GET 30x would otherwise yield an empty body and a
        # misleading "empty file" error.
        if response.status_code in _REDIRECT_STATUSES:
            raise InvalidURLError('Unexpected redirect on download')
        response.raise_for_status()

        file_data = self._read_body_within_budget(response)

        if not file_data:
            raise DownloadError('Empty file downloaded')

        return bytes(file_data)

    def _read_body_within_budget(self, response: requests.Response) -> bytearray:
        """
        Read the streamed body under a hard wall-clock budget.

        Checking the clock between `iter_content` chunks is not enough: a chunk
        is only yielded once `chunk_size` bytes have arrived (or the body
        ends), and the per-socket timeout resets on every byte received. A
        server dripping one byte every 29s therefore keeps a single iteration
        blocked for days without ever tripping `timeout_download`, and the
        between-chunk check never runs.

        So the read loop itself must be abandonable. It runs on a worker thread
        while the request thread waits at most `max_download_seconds` for the
        result; on expiry the connection is torn down so the worker unblocks
        and dies with it.
        """
        if self.max_download_seconds <= 0:
            raise DownloadError('Download timed out')

        executor = ThreadPoolExecutor(
            max_workers=1, thread_name_prefix='gis-download'
        )
        try:
            future = executor.submit(self._read_body, response)
            try:
                return future.result(timeout=self.max_download_seconds)
            except FutureTimeoutError as e:
                _abort_response(response)
                raise DownloadError('Download timed out') from e
        finally:
            # Never join the worker: on the timeout path it is exactly the
            # thread we could not wait for.
            executor.shutdown(wait=False)

    def _read_body(self, response: requests.Response) -> bytearray:
        """Accumulate the streamed body, enforcing the size cap as it grows."""
        file_data = bytearray()

        for chunk in response.iter_content(chunk_size=self.chunk_size):
            if not chunk:
                continue
            file_data.extend(chunk)
            if len(file_data) > self.max_file_size:
                raise FileSizeError(
                    f'File too large during download '
                    f'(max: {self.max_file_size / (1024 * 1024)}MB)'
                )

        return file_data
