import urllib.parse
import aiohttp
from bs4 import BeautifulSoup
from .base import BaseScraper, VideoResult


class EpornerScraper(BaseScraper):
    site_name = "Eporner"
    base_url = "https://www.eporner.com"

    async def search(self, session: aiohttp.ClientSession, query: str) -> list[VideoResult]:
        encoded = urllib.parse.quote_plus(query)
        pages = [
            f"{self.base_url}/search/{encoded}/",
            f"{self.base_url}/search/{encoded}/2/",
        ]
        results = []
        for url in pages:
            html = await self.fetch(session, url)
            if html:
                results.extend(self.parse(html))
        return results

    def parse(self, html: str) -> list[VideoResult]:
        soup = BeautifulSoup(html, "html.parser")
        results = []
        items = (
            soup.select("div#videos div.mb")
            or soup.select("div.mb")
            or soup.select("[class*='video-block']")
            or soup.select("article[class*='video']")
        )
        for item in items:
            a = item.select_one("a")
            title_el = (
                item.select_one("strong.mbtit")
                or item.select_one("[class*='title']")
                or a
            )
            img = item.select_one("img")
            duration_el = (
                item.select_one("span.mbtim")
                or item.select_one("[class*='dur']")
            )
            views_el = (
                item.select_one("span.mbvw")
                or item.select_one("[class*='view']")
            )
            if not a:
                continue
            href = a.get("href", "")
            if href and not href.startswith("http"):
                href = self.base_url + href
            title = title_el.get_text(strip=True) if title_el else a.get("title", "")
            thumbnail = img.get("data-src") or img.get("src", "") if img else ""
            results.append(VideoResult(
                title=title,
                url=href,
                thumbnail=thumbnail,
                duration=duration_el.get_text(strip=True) if duration_el else "",
                site=self.site_name,
                views=views_el.get_text(strip=True) if views_el else "",
            ))
        return results
