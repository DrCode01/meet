import urllib.parse
import aiohttp
from bs4 import BeautifulSoup
from .base import BaseScraper, VideoResult


class SpankBangScraper(BaseScraper):
    site_name = "SpankBang"
    base_url = "https://spankbang.com"

    async def search(self, session: aiohttp.ClientSession, query: str) -> list[VideoResult]:
        encoded = urllib.parse.quote_plus(query)
        pages = [
            f"{self.base_url}/s/{encoded}/",
            f"{self.base_url}/s/{encoded}/2/",
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
            soup.select("div.video-item")
            or soup.select("[class*='video-item']")
            or soup.select("div.list-item")
            or soup.select("article[class*='video']")
        )
        for item in items:
            a = item.select_one("a[href]")
            title_el = (
                item.select_one("p.n")
                or item.select_one("[class*='title']")
                or item.select_one("[class*='name']")
            )
            img = item.select_one("img")
            duration_el = (
                item.select_one("span.l")
                or item.select_one("[class*='dur']")
                or item.select_one("[class*='time']")
            )
            views_el = (
                item.select_one("span.v")
                or item.select_one("[class*='view']")
            )
            if not a or not title_el:
                continue
            href = a.get("href", "")
            if href and not href.startswith("http"):
                href = self.base_url + href
            thumbnail = ""
            if img:
                thumbnail = img.get("data-src") or img.get("src", "")
            results.append(VideoResult(
                title=title_el.get_text(strip=True),
                url=href,
                thumbnail=thumbnail,
                duration=duration_el.get_text(strip=True) if duration_el else "",
                site=self.site_name,
                views=views_el.get_text(strip=True) if views_el else "",
            ))
        return results
