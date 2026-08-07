import urllib.parse

from .base import BaseScraper, VideoResult, find_video_list, first_str

_API = "https://www.eporner.com/api/v2/video/search/"


class EpornerScraper(BaseScraper):
    site_name = "Eporner"
    base_url = "https://www.eporner.com"

    def search_urls(self, query: str) -> list[str]:
        return [
            _API + "?" + urllib.parse.urlencode({
                "query": query,
                "per_page": "30",
                "page": str(page),
                "thumbsize": "medium",
                "order": "top-rated",
                "format": "json",
                "gay": "0",
                "site": "eporner",
            })
            for page in (1, 2)
        ]

    def parse(self, body: str) -> list[VideoResult]:
        results = []
        for v in find_video_list(self.load_json(body)):
            url = first_str(v, "url")
            if not url:
                continue
            thumb = v.get("default_thumb")
            results.append(VideoResult(
                title=first_str(v, "title"),
                url=url if url.startswith("http") else self.base_url + url,
                thumbnail=thumb.get("src", "") if isinstance(thumb, dict) else first_str(v, "default_thumb"),
                duration=first_str(v, "length_min", "duration"),
                site=self.site_name,
                views=first_str(v, "views"),
                rating=first_str(v, "rate"),
            ))
        return results
