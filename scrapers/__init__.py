from .base import BaseScraper, VideoResult
from .xvideos import XVideosScraper
from .xhamster import XHamsterScraper
from .spankbang import SpankBangScraper
from .eporner import EpornerScraper
from .xnxx import XnxxScraper
from .redtube import RedTubeScraper
from .pornhub import PornHubScraper

ALL_SCRAPERS = [
    PornHubScraper,
    XVideosScraper,
    XnxxScraper,
    XHamsterScraper,
    SpankBangScraper,
    EpornerScraper,
    RedTubeScraper,
]
