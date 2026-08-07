"""Offline parser tests — no network required.

Sample payloads mirror each API's documented/observed response shape. These
verify parsing and the tolerance helpers; they cannot verify that the endpoints
are reachable from a given host.
"""
import asyncio
import json

import pytest

from scrapers import ALL_SCRAPERS
from scrapers.base import FetchOutcome, find_video_list, first_str
from scrapers.beeg import BeegScraper
from scrapers.eporner import EpornerScraper
from scrapers.pornhub import PornHubScraper
from scrapers.redtube_api import RedTubeApiScraper
from scrapers.xvideos import XVideosScraper
from scrapers.youporn import YouPornScraper


def test_every_scraper_declares_two_search_urls():
    for scraper_cls in ALL_SCRAPERS:
        urls = scraper_cls().search_urls("granny deepthroat")
        assert len(urls) == 2, scraper_cls.site_name
        assert all(u.startswith("https://") for u in urls), scraper_cls.site_name
        # Query must be encoded into every URL, not dropped.
        assert "granny" in urls[0], scraper_cls.site_name


def test_search_urls_encode_spaces_and_specials():
    for scraper_cls in ALL_SCRAPERS:
        url = scraper_cls().search_urls("a b&c")[0]
        assert " " not in url, scraper_cls.site_name


# ── find_video_list tolerance ──

@pytest.mark.parametrize("payload", [
    {"videos": [{"id": 1}]},
    {"results": [{"id": 1}]},
    {"data": {"videos": [{"id": 1}]}},
    {"response": {"items": [{"id": 1}]}},
    [{"id": 1}],
])
def test_find_video_list_handles_shape_variants(payload):
    assert find_video_list(payload) == [{"id": 1}]


@pytest.mark.parametrize("payload", [{}, {"videos": []}, {"error": "blocked"}, "", 0])
def test_find_video_list_empty_payloads(payload):
    assert find_video_list(payload) == []


def test_find_video_list_does_not_recurse_forever():
    deep = cur = {}
    for _ in range(50):
        cur["data"] = {}
        cur = cur["data"]
    assert find_video_list(deep) == []


def test_first_str_skips_empty_values():
    assert first_str({"a": "", "b": None, "c": 7}, "a", "b", "c") == "7"
    assert first_str({}, "a", default="fallback") == "fallback"


# ── per-site parsing ──

def test_pornhub_parse():
    body = json.dumps({"videos": [{
        "title": "Clip", "url": "https://www.pornhub.com/view_video.php?viewkey=x",
        "thumb": "https://t.example/1.jpg", "duration": "12:00",
        "views": 1234, "rating": 88,
    }]})
    (v,) = PornHubScraper().parse(body)
    assert v.title == "Clip"
    assert v.site == "PornHub"
    assert v.views == "1234"
    assert v.rating == "88"


def test_pornhub_skips_entries_without_url():
    body = json.dumps({"videos": [{"title": "no url"}]})
    assert PornHubScraper().parse(body) == []


def test_eporner_parse_builds_absolute_url_and_nested_thumb():
    body = json.dumps({"videos": [{
        "title": "Clip", "url": "/video-abc/clip/",
        "default_thumb": {"src": "https://t.example/2.jpg"},
        "length_min": "8:20", "views": 99, "rate": "4.5",
    }]})
    (v,) = EpornerScraper().parse(body)
    assert v.url == "https://www.eporner.com/video-abc/clip/"
    assert v.thumbnail == "https://t.example/2.jpg"
    assert v.duration == "8:20"


def test_eporner_keeps_absolute_urls_unchanged():
    body = json.dumps({"videos": [{"title": "C", "url": "https://www.eporner.com/x/"}]})
    (v,) = EpornerScraper().parse(body)
    assert v.url == "https://www.eporner.com/x/"


def test_redtube_unwraps_nested_video_key_and_picks_largest_thumb():
    body = json.dumps({"videos": [{"video": {
        "video_id": "555", "title": "Clip", "duration": "10:00",
        "thumb": "https://t.example/small.jpg",
        "thumbs": [{"src": "https://t.example/small.jpg"},
                   {"src": "https://t.example/large.jpg"}],
        "views": "42", "rating": "9",
    }}]})
    (v,) = RedTubeApiScraper().parse(body)
    assert v.title == "Clip"
    assert v.thumbnail == "https://t.example/large.jpg"
    assert v.url == "https://www.redtube.com/555"


def test_redtube_handles_flat_entries():
    body = json.dumps({"videos": [{"video_id": "7", "title": "Flat"}]})
    (v,) = RedTubeApiScraper().parse(body)
    assert v.url == "https://www.redtube.com/7"


def test_beeg_parse_and_thumbnail_fallback():
    body = json.dumps({"videos": [{"id": "9090", "title": "Clip", "duration": 600}]})
    (v,) = BeegScraper().parse(body)
    assert v.url == "https://beeg.com/9090"
    assert v.thumbnail == "https://img.beeg.com/236x177/9090.jpg"
    assert v.duration == "600"


def test_beeg_skips_entries_missing_id_or_title():
    body = json.dumps({"videos": [{"id": "1"}, {"title": "no id"}]})
    assert BeegScraper().parse(body) == []


def test_youporn_parse_relative_url():
    body = json.dumps({"data": {"videos": [{
        "title": "Clip", "url": "/watch/123/clip/", "thumb": "https://t.example/3.jpg",
        "duration": 480, "views": 12,
    }]}})
    (v,) = YouPornScraper().parse(body)
    assert v.url == "https://www.youporn.com/watch/123/clip/"
    assert v.site == "YouPorn"


def test_xvideos_parse_html():
    html = """
    <div class="thumb-block">
      <img data-src="https://t.example/4.jpg"/>
      <p class="title"><a href="/video123/clip">Clip Title</a></p>
      <span class="duration">15 min</span>
    </div>
    """
    (v,) = XVideosScraper().parse(html)
    assert v.title == "Clip Title"
    assert v.url == "https://www.xvideos.com/video123/clip"
    assert v.thumbnail == "https://t.example/4.jpg"
    assert v.duration == "15 min"


def test_xvideos_ignores_incomplete_blocks():
    assert XVideosScraper().parse('<div class="thumb-block"><p>nothing</p></div>') == []


# ── failure modes: a blocked or changed endpoint must not crash the parser ──

@pytest.mark.parametrize("scraper_cls", [
    PornHubScraper, EpornerScraper, RedTubeApiScraper, BeegScraper, YouPornScraper,
])
def test_json_scrapers_return_empty_on_unexpected_shape(scraper_cls):
    assert scraper_cls().parse(json.dumps({"error": "access denied"})) == []
    assert scraper_cls().parse(json.dumps([])) == []


@pytest.mark.parametrize("scraper_cls", [
    PornHubScraper, EpornerScraper, RedTubeApiScraper, BeegScraper, YouPornScraper,
])
def test_json_scrapers_raise_on_html_block_page(scraper_cls):
    """An HTML block page is a JSON decode error — search() records it as a parse failure."""
    with pytest.raises(json.JSONDecodeError):
        scraper_cls().parse("<html><body>403 Forbidden</body></html>")


# ── search() orchestration: paging, diagnostics, error reporting ──

def run_search(scraper, canned):
    """Drive search() with canned fetch results instead of real HTTP."""
    calls = []

    async def fake_fetch(session, url):
        calls.append(url)
        outcome = canned[len(calls) - 1]
        outcome.url = url
        return outcome

    scraper.fetch = fake_fetch
    result = asyncio.run(scraper.search(None, "q"))
    return result, calls


def _page(n):
    return FetchOutcome(url="", status=200, body=json.dumps(
        {"videos": [{"id": str(i), "title": f"t{i}"} for i in range(n)]}
    ))


def test_search_pages_through_both_urls():
    outcome, calls = run_search(BeegScraper(), [_page(30), _page(30)])
    assert len(calls) == 2
    assert len(outcome.results) == 60
    assert outcome.error == ""
    assert [f.count for f in outcome.fetches] == [30, 30]


def test_search_stops_paging_on_empty_page():
    outcome, calls = run_search(BeegScraper(), [_page(0), _page(30)])
    assert len(calls) == 1, "must not request page 2 after an empty page 1"
    assert outcome.error == "0 results"


def test_search_stops_and_reports_http_error():
    outcome, calls = run_search(
        BeegScraper(), [FetchOutcome(url="", status=403, body="denied")]
    )
    assert len(calls) == 1
    assert outcome.error == "HTTP 403"
    assert outcome.results == []


def test_search_reports_connection_error():
    outcome, _ = run_search(
        BeegScraper(), [FetchOutcome(url="", error="ClientConnectorError: nope")]
    )
    assert outcome.error == "ClientConnectorError: nope"


def test_search_reports_parse_failure_on_html_block_page():
    outcome, _ = run_search(
        BeegScraper(),
        [FetchOutcome(url="", status=200, body="<html>403 Forbidden</html>")],
    )
    assert "parse failed" in outcome.error
    assert outcome.results == []


def test_as_stat_omits_body():
    stat = FetchOutcome(url="u", status=200, body="x" * 5000, count=3).as_stat()
    assert set(stat) == {"url", "status", "error", "count"}


def test_body_head_is_truncated():
    assert len(FetchOutcome(url="u", body="x" * 5000).body_head) == 400
