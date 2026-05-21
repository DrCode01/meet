import asyncio
import aiohttp
from fastapi import FastAPI, Request, Query
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from scrapers import ALL_SCRAPERS

app = FastAPI(title="Adult Search Aggregator")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/search", response_class=HTMLResponse)
async def search(request: Request, q: str = Query(default="", min_length=1)):
    results = []
    errors = []

    connector = aiohttp.TCPConnector(ssl=False, limit=20)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [scraper().search(session, q) for scraper in ALL_SCRAPERS]
        scraped = await asyncio.gather(*tasks, return_exceptions=True)

    for scraper_cls, outcome in zip(ALL_SCRAPERS, scraped):
        if isinstance(outcome, Exception):
            errors.append(f"{scraper_cls.site_name}: {outcome}")
        else:
            results.extend(outcome)

    # Deduplicate by URL
    seen = set()
    unique = []
    for r in results:
        if r.url not in seen:
            seen.add(r.url)
            unique.append(r)

    return templates.TemplateResponse("results.html", {
        "request": request,
        "query": q,
        "results": unique,
        "total": len(unique),
        "errors": errors,
        "sites": [s.site_name for s in ALL_SCRAPERS],
    })


@app.get("/api/search")
async def api_search(q: str = Query(default="", min_length=1)):
    results = []
    connector = aiohttp.TCPConnector(ssl=False, limit=20)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [scraper().search(session, q) for scraper in ALL_SCRAPERS]
        scraped = await asyncio.gather(*tasks, return_exceptions=True)

    for outcome in scraped:
        if not isinstance(outcome, Exception):
            results.extend([vars(r) for r in outcome])

    seen = set()
    unique = []
    for r in results:
        if r["url"] not in seen:
            seen.add(r["url"])
            unique.append(r)

    return {"query": q, "total": len(unique), "results": unique}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
