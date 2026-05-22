import urllib.parse
import aiohttp
from bs4 import BeautifulSoup
from .base import BaseScraper, VideoResult


class RedTubeScraper(BaseScraper):
    site_name = "RedTube"
    base_url = "https://www.redtube.com"

    async def search(self, session: aiohttp.ClientSession, query: str) -> list[VideoResult]:
        encoded = urllib.parse.quote_plus(query)
        results = []
        for page in [1, 2]:
            url = f"{self.base_url}/?search={encoded}&page={page}"
            status, html = await self.fetch(session, url)
            if status == 200 and html:
                results.extend(self.parse(html))
        return results

    def parse(self, html: str) -> list[VideoResult]:
        soup = BeautifulSoup(html, "html.parser")
        results = []
        items = (
            soup.select("li.video_item")
            or soup.select("div.video_item")
            or soup.select("article.video-item")
            or soup.select("[class*='video-item']")
            or soup.select("[class*='videoItem']")
        )
        for item in items:
            a = item.select_one("a.video_link") or item.select_one("a[href*='/']")
            title_el = (
                item.select_one("div.video_title")
                or item.select_one("[class*='title']")
            )
            img = item.select_one("img")
            dur = item.select_one("span.video_duration") or item.select_one("[class*='duration']")
            views = item.select_one("span.videoViews") or item.select_one("[class*='views']")
            if not a:
                continue
            href = a.get("href", "")
            if href and not href.startswith("http"):
                href = self.base_url + href
            title = title_el.get_text(strip=True) if title_el else a.get("title", "")
            results.append(VideoResult(
                title=title,
                url=href,
                thumbnail=img.get("data-src") or img.get("src", "") if img else "",
                duration=dur.get_text(strip=True) if dur else "",
                site=self.site_name,
                views=views.get_text(strip=True) if views else "",
            ))
        return results
