import hashlib
import json
import time

from configs.redis import get_redis

from services.analysis_engine import CodeAnalyzer
from services.auto_fixer import AutoFixer
from services.validation_engine import ValidationEngine
from services.postprocessor import Postprocessor
from services.metrics import MetricsCalculator


class AIService:
    def __init__(self):
        self.analysis_engine = CodeAnalyzer()
        self.auto_fixer = AutoFixer()
        self.validator = ValidationEngine()
        self.postprocessor = Postprocessor()
        self.metrics = MetricsCalculator()

    async def review_code(
        self,
        code: str,
        language: str,
    ):
        start = time.time()

        redis = await get_redis()

        key = hashlib.md5(
            f"{code[:500]}_{language}".encode()
        ).hexdigest()

        cached = None

        if redis:
            cached = await redis.get(
                f"review:{key}"
            )

        if cached:
            return json.loads(cached)

        issues = self.analysis_engine.analyze(
            code,
            language,
            None,
        )

        processed = self.postprocessor.process(
            issues,
            len(code.split("\n")),
        )

        latency = (
            time.time() - start
        ) * 1000

        self.metrics.track_latency(latency)

        if redis:
            await redis.setex(
                f"review:{key}",
                300,
                json.dumps(processed),
            )

        return processed

    async def auto_fix(
        self,
        code: str,
        language: str,
    ):
        issues = self.analysis_engine.analyze(
            code,
            language,
            None,
        )

        fix_result = self.auto_fixer.auto_fix(
            code,
            issues,
            language,
        )

        self.metrics.track_fix_attempt(
            fix_result.success
        )

        return {
            "fixed_code": fix_result.fixed_code,
            "applied_fixes": fix_result.applied_fixes,
            "validation_passed": (
                fix_result.validation_passed
            ),
        }