import urllib.parse

from .base import BaseScraper, VideoResult, find_video_list, first_str

# Unverified endpoint — kept tolerant so a shape change degrades to 0 results
# with a visible status rather than a crash.
_API = "https://www.youporn.com/api/v2/video/search/"


class YouPornScraper(BaseScraper):
    site_name = "YouPorn"
    base_url = "https://www.youporn.com"

    def search_urls(self, query: str) -> list[str]:
        return [
            _API + "?" + urllib.parse.urlencode({
                "query": query,
                "per_page": "30",
                "page": str(page),
            })
            for page in (1, 2)
        ]

    def parse(self, body: str) -> list[VideoResult]:
        results = []
        for v in find_video_list(self.load_json(body)):
            url = first_str(v, "url", "video_url")
            if not url:
                continue
            results.append(VideoResult(
                title=first_str(v, "title", "name"),
                url=url if url.startswith("http") else f"{self.base_url}{url}",
                thumbnail=first_str(v, "thumb", "thumbnail", "image"),
                duration=first_str(v, "duration", "length"),
                site=self.site_name,
                views=first_str(v, "views"),
                rating=first_str(v, "rating", "rate"),
            ))
        return results
