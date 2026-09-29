---
---

Map server: upgrade FastAPI 0.104 → 0.141 (Starlette 1.7), Uvicorn 0.53,
AnyIO 4.15 and certifi 2026.7.22, dropping the distrusted e-Tugra and
GLOBALTRUST roots and the AnyIO thread-race advisory. Requires Python 3.10+
(the container already runs 3.12).
