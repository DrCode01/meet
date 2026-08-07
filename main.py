import asyncio
import os

import aiohttp
from fastapi import FastAPI, Query, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from scrapers import ALL_SCRAPERS

PW_HASH = os.getenv(
    "PW_HASH",
    "bea14985d52161d8bbfd5dee7235d31ed42eb037b11bfb38a2502519cdb996a1",
)

app = FastAPI(title="Adult Search Aggregator")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

SCRAPER_MAP = {s.site_name: s for s in ALL_SCRAPERS}


def _session() -> aiohttp.ClientSession:
    return aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=False, limit=20))


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    # request-first signature: required by starlette >= 1.0, supported since 0.29
    return templates.TemplateResponse(request, "app.html", {"pw_hash": PW_HASH})


@app.get("/api/search")
async def api_search(q: str = Query(default="", min_length=1)):
    async with _session() as session:
        outcomes = await asyncio.gather(
            *(scraper().search(session, q) for scraper in ALL_SCRAPERS),
            return_exceptions=True,
        )

    results, site_stats = [], []
    for scraper_cls, outcome in zip(ALL_SCRAPERS, outcomes):
        if isinstance(outcome, Exception):
            site_stats.append({
                "site": scraper_cls.site_name,
                "count": 0,
                "error": f"{type(outcome).__name__}: {outcome}",
                "fetches": [],
            })
            continue
        site_stats.append({
            "site": outcome.site,
            "count": len(outcome.results),
            "error": outcome.error,
            "fetches": [f.as_stat() for f in outcome.fetches],
        })
        results.extend(vars(r) for r in outcome.results)

    seen, unique = set(), []
    for r in results:
        if r["url"] not in seen:
            seen.add(r["url"])
            unique.append(r)

    return {"query": q, "total": len(unique), "results": unique, "site_stats": site_stats}


@app.get("/api/debug")
async def debug(site: str = Query(default=""), q: str = Query(default="test")):
    """Raw per-site request trace: the URL hit, HTTP status, and the head of the response body.

    Paste the output back when a site shows red — the body head distinguishes an
    IP block from a payload whose shape changed.
    """
    if site and site not in SCRAPER_MAP:
        return {"error": f"Unknown site '{site}'", "available": list(SCRAPER_MAP)}

    targets = [SCRAPER_MAP[site]] if site else list(ALL_SCRAPERS)
    report = []

    async with _session() as session:
        for scraper_cls in targets:
            scraper = scraper_cls()
            url = scraper.search_urls(q)[0]
            fetched = await scraper.fetch(session, url)
            parsed, parse_error = [], ""
            if fetched.status == 200 and fetched.body:
                try:
                    parsed = scraper.parse(fetched.body)
                except Exception as e:
                    parse_error = f"{type(e).__name__}: {e}"
            report.append({
                "site": scraper.site_name,
                "url": url,
                "http_status": fetched.status,
                "fetch_error": fetched.error,
                "response_length": len(fetched.body),
                "parsed_count": len(parsed),
                "parse_error": parse_error,
                "body_head": fetched.body_head,
                "first_result": vars(parsed[0]) if parsed else None,
            })

    return {"query": q, "sites": report}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
