---
"@wildfires-org/turboplan-map-server": patch
---

The map server's `fiona` moves from 1.9.5 to 1.10.1, which bundles GDAL 3.9.2,
PROJ 9.4.1 and libjpeg 9f instead of GDAL 3.6.4, PROJ 9.0.1 and libjpeg 9c. This
closes Dependabot's critical alert for the MiniZip overflow in the bundled GDAL
(CVE-2023-45853) and the high alert for the bundled libjpeg (CVE-2020-14152),
both reachable through uploaded GIS files. zlib and expat now come from the
container's system libraries. `setuptools`, needed only by fiona 1.9.5, drops
out of the lock.

`shapely` and `numpy` are removed. Nothing imported shapely, and the locked
shapely 2.0.2 could not even be imported next to numpy 2.0.2.

Uploaded layers now come back with coordinates rounded to 6 decimal places
(about 0.11 m) and without elevation, as the geometry optimizer always intended.
It only handled lists, while fiona returns positions as tuples, so it never
ran. Responses for coordinate-heavy files are up to about 19% smaller. Leaflet
ignores elevation, and layers saved earlier keep their stored coordinates.

Shapefiles, GeoPackages, KML/KMZ, GeoJSON and File Geodatabases otherwise
produce the same layers, features, geometry types and bounds as before. The
only other visible difference is in the per-layer `info.schema` type names
(`int` → `int32`, `int:1` → `bool`), which nothing downstream reads.
