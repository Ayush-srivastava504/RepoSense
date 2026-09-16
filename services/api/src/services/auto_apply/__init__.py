"""
Auto Apply Engine Package for RepoSense (InternFlow)
Implements the 5 core layers:
1. Ingestion: Resume / LinkedIn parsing into structured profile data
2. Discovery: Programmatic ATS job feed & database discovery
3. Matching: Hybrid ATS rule evaluation + semantic embedding similarity
4. Application: Async Playwright stealth form automation
5. Tracking: DB persistence, application state logging & version lineage
"""

from .ingestion import ProfileIngestionEngine, CandidateProfile
from .discovery import JobDiscoveryEngine, DiscoveredJob
from .matching import JobMatchingEngine, MatchResult
from .application import ApplicationEngine, ApplicationSubmissionResult
from .tracker import ApplicationTrackerEngine, ApplicationRecord

__all__ = [
    "ProfileIngestionEngine",
    "CandidateProfile",
    "JobDiscoveryEngine",
    "DiscoveredJob",
    "JobMatchingEngine",
    "MatchResult",
    "ApplicationEngine",
    "ApplicationSubmissionResult",
    "ApplicationTrackerEngine",
    "ApplicationRecord",
]
