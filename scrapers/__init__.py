from .base import BaseScraper, VideoResult
from .pornhub import PornHubScraper
from .xvideos import XVideosScraper
from .eporner import EpornerScraper
from .redtube_api import RedTubeApiScraper
from .beeg import BeegScraper
from .youporn import YouPornScraper

ALL_SCRAPERS = [
    PornHubScraper,
    XVideosScraper,
    EpornerScraper,
    RedTubeApiScraper,
    BeegScraper,
    YouPornScraper,
]
