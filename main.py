import asyncio
import os
import aiohttp
from fastapi import FastAPI, Request, Query
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
            site_stats.append({"site": scraper_cls.site_name, "count": 0})
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
