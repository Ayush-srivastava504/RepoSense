import numpy as np
from typing import List, Dict, Any

class MetricsCalculator:
    def __init__(self):
        self.latency_history = []
        self.fix_history = []

    def track_latency(self, ms: float):
        self.latency_history.append(ms)

    def track_fix_attempt(self, success: bool):
        self.fix_history.append(success)

    def get_summary(self) -> Dict:
        return {
            'avg_latency_ms': np.mean(self.latency_history[-1000:]) if self.latency_history else 0,
            'fix_success_rate': np.mean(self.fix_history[-100:]) if self.fix_history else 0
        }