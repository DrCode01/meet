import json
import re
import urllib.parse
import aiohttp
from bs4 import BeautifulSoup
from .base import BaseScraper, VideoResult


class SpankBangScraper(BaseScraper):
    site_name = "SpankBang"
    base_url = "https://spankbang.com"

    async def search(self, session: aiohttp.ClientSession, query: str) -> list[VideoResult]:
        encoded = urllib.parse.quote_plus(query)
        results = []
        for page in [1, 2]:
            url = f"{self.base_url}/s/{encoded}/{page}/"
            status, html = await self.fetch(session, url)
            if status == 200 and html:
                results.extend(self.parse(html))
        return results

    def parse(self, html: str) -> list[VideoResult]:
        soup = BeautifulSoup(html, "html.parser")
        results = []
        items = (
            soup.select("div.video-item")
            or soup.select("[class*='video-item']")
            or soup.select("div.stream-item")
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
            dur = item.select_one("span.l") or item.select_one("[class*='dur']") or item.select_one("[class*='time']")
            views = item.select_one("span.v") or item.select_one("[class*='view']")
            if not a or not title_el:
                continue
            href = a.get("href", "")
            if href and not href.startswith("http"):
                href = self.base_url + href
            results.append(VideoResult(
                title=title_el.get_text(strip=True),
                url=href,
                thumbnail=img.get("data-src") or img.get("src", "") if img else "",
                duration=dur.get_text(strip=True) if dur else "",
                site=self.site_name,
                views=views.get_text(strip=True) if views else "",
            ))
        return results
