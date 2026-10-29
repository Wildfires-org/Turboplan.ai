"""
Lock GDAL down before it reads any upload.

Uploads are untrusted, and GDAL picks a driver by sniffing a file's content.
Several drivers it ships treat a file as a pointer to other data (a VRT names
other datasets, URLs included; a WFS description names a server; GML points
at remote schemas), so opening such a file would make this service fetch
whatever the file names. Three layers keep that out:

- ``GDAL_SKIP`` unregisters every vector driver except ``ALLOWED_DRIVERS``.
- ``GDAL_HTTP_PROXY`` / ``GDAL_HTTPS_PROXY`` point GDAL's own HTTP client
  (``/vsicurl/`` and every driver's fetches, e.g. a GeoJSON "crs" URL) at a
  closed local port, so no driver can reach the network. ``NO_PROXY`` is
  removed because libcurl would bypass the proxy for the hosts it lists.
  Uploads are downloaded with ``requests``, which ignores all of these.
- ``GISFileProcessorService`` opens each layer with the one driver its file
  type implies.
"""

import logging
import os

from fiona.env import Env

logger = logging.getLogger(__name__)

# The formats this service reads: Shapefile, GeoPackage, GeoJSON, KML
# (LIBKML when the build has it, as it also reads ExtendedData) and File
# Geodatabase.
ALLOWED_DRIVERS = frozenset({
    'ESRI Shapefile',
    'GPKG',
    'GeoJSON',
    'KML',
    'LIBKML',
    'OpenFileGDB',
})

# Port 1 (tcpmux) is never served here, so every GDAL HTTP request fails
# straight away with "connection refused".
UNREACHABLE_PROXY = '127.0.0.1:1'

NO_PROXY_VARIABLES = ('NO_PROXY', 'no_proxy')


def _registered_vector_drivers() -> set:
    with Env() as env:
        return set(env.drivers())


def _split_driver_list(value: str) -> list:
    """GDAL reads GDAL_SKIP as comma-separated, or space-separated without commas."""
    separator = ',' if ',' in value else None
    return [name.strip() for name in value.split(separator) if name.strip()]


def _block_network() -> None:
    os.environ['GDAL_HTTP_PROXY'] = UNREACHABLE_PROXY
    # GDAL uses this one instead for https URLs when it is set.
    os.environ['GDAL_HTTPS_PROXY'] = UNREACHABLE_PROXY

    # libcurl skips the proxy for hosts listed in NO_PROXY, and GDAL has no
    # setting of its own to override that, so the variable has to go for the
    # whole process. Nothing here relies on it: the downloader ignores
    # environment proxy settings (trust_env=False), and Sentry only reads it
    # when an HTTP proxy is configured.
    for name in NO_PROXY_VARIABLES:
        if os.environ.pop(name, None) is not None:
            logger.warning('Ignoring %s: GDAL must not bypass its blocking proxy', name)

    # PROJ's default already; pinned so grids are never downloaded.
    os.environ['PROJ_NETWORK'] = 'OFF'
    # LIBKML's default already; pinned so remote styles are never fetched.
    os.environ['LIBKML_RESOLVE_STYLE'] = 'NO'


def configure_gdal() -> None:
    """
    Cut GDAL off from the network and unregister every driver this service
    does not read. Raises RuntimeError when a driver stays registered, so the
    service never runs without the restriction.

    GDAL has no allow-list setting, and it warns about every GDAL_SKIP name a
    build lacks (on each registration, which Fiona repeats per call). So the
    skip list is built from the drivers this build actually registered.
    """
    _block_network()

    unwanted = _registered_vector_drivers() - ALLOWED_DRIVERS
    if not unwanted:
        return

    skipped = _split_driver_list(os.environ.get('GDAL_SKIP', ''))
    skipped += sorted(unwanted - set(skipped))
    # Commas, not spaces: several driver names contain spaces.
    os.environ['GDAL_SKIP'] = ','.join(skipped)

    # GDAL applies GDAL_SKIP whenever it registers drivers, which Fiona does
    # again on entering a new environment. Confirm it took effect.
    remaining = _registered_vector_drivers() - ALLOWED_DRIVERS
    if remaining:
        raise RuntimeError(
            'GDAL drivers could not be disabled: ' + ', '.join(sorted(remaining))
        )
