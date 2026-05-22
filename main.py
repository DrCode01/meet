import asyncio
import os
import aiohttp
from fastapi import FastAPI, Request, Query
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from scrapers import ALL_SCRAPERS
from scrapers.base import HEADERS

PW_HASH = os.getenv(
    "PW_HASH",
    "bea14985d52161d8bbfd5dee7235d31ed42eb037b11bfb38a2502519cdb996a1",
)

app = FastAPI(title="Adult Search Aggregator")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

SCRAPER_MAP = {s.site_name: s for s in ALL_SCRAPERS}


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("app.html", {"request": request, "pw_hash": PW_HASH})


@app.get("/api/search")
async def api_search(q: str = Query(default="", min_length=1)):
    results = []
    site_stats = []

    connector = aiohttp.TCPConnector(ssl=False, limit=20)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [scraper().search(session, q) for scraper in ALL_SCRAPERS]
        scraped = await asyncio.gather(*tasks, return_exceptions=True)

    for scraper_cls, outcome in zip(ALL_SCRAPERS, scraped):
        if isinstance(outcome, Exception):
            site_stats.append({"site": scraper_cls.site_name, "count": 0, "error": str(outcome)})
        else:
            site_stats.append({"site": scraper_cls.site_name, "count": len(outcome)})
            results.extend([vars(r) for r in outcome])

    seen = set()
    unique = []
    for r in results:
        if r["url"] not in seen:
            seen.add(r["url"])
            unique.append(r)

    return {"query": q, "total": len(unique), "results": unique, "site_stats": site_stats}


@app.get("/api/debug")
async def debug(site: str = Query(...), q: str = Query(default="test")):
    """Temporary endpoint: shows what a site actually returns so we can fix selectors."""
    scraper_cls = SCRAPER_MAP.get(site)
    if not scraper_cls:
        return {"error": f"Unknown site. Available: {list(SCRAPER_MAP.keys())}"}

    scraper = scraper_cls()
    import urllib.parse
    encoded = urllib.parse.quote_plus(q)

    # Build the first search URL for this scraper
    site_urls = {
        "XNXX": f"https://www.xnxx.com/search/{q.replace(' ', '+')}/0",
        "xHamster": f"https://xhamster.com/search/{encoded}",
        "SpankBang": f"https://spankbang.com/s/{encoded}/",
        "Eporner": f"https://www.eporner.com/api/v2/video/search/?query={encoded}&per_page=5&format=json",
        "RedTube": f"https://www.redtube.com/?search={encoded}",
        "xVideos": f"https://www.xvideos.com/?k={encoded}",
        "PornHub": f"https://www.pornhub.com/webmasters/search?search={encoded}&per_page=3",
    }

    url = site_urls.get(site, "")
    if not url:
        return {"error": "No URL for site"}

    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        status, html = await scraper.fetch(session, url)

    snippet = (html or "")[:3000]
    return {
        "site": site,
        "url": url,
        "http_status": status,
        "response_length": len(html or ""),
        "snippet": snippet,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
