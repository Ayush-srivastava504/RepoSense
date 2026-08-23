# Module: src/services/leetcode_service.py
# Defines class(es): TestCase, Problem
# Defines function(s): _two_sum_tests, _reverse_linked_list_tests, _valid_parentheses_tests, _max_subarray_tests, _climbing_stairs_tests, _run_in_process, judge_submission, list_problems
#

import multiprocessing as mp
import traceback
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

@dataclass
class TestCase:
    args: tuple
    expected: Any

@dataclass
class Problem:
    slug: str
    title: str
    difficulty: str
    description: str
    function_name: str
    starter_code: str
    test_cases: list[TestCase] = field(default_factory=list)
    reference_solution: Optional[str] = None

def _two_sum_tests():
    return [TestCase(([2, 7, 11, 15], 9), [0, 1]), TestCase(([3, 2, 4], 6), [1, 2]), TestCase(([3, 3], 6), [0, 1])]

def _reverse_linked_list_tests():
    return [TestCase(([1, 2, 3, 4, 5],), [5, 4, 3, 2, 1]), TestCase(([],), []), TestCase(([1],), [1])]

def _valid_parentheses_tests():
    return [TestCase(('()',), True), TestCase(('()[]{}',), True), TestCase(('(]',), False), TestCase(('([)]',), False), TestCase(('{[]}',), True)]

def _max_subarray_tests():
    return [TestCase(([-2, 1, -3, 4, -1, 2, 1, -5, 4],), 6), TestCase(([1],), 1), TestCase(([5, 4, -1, 7, 8],), 23)]

def _climbing_stairs_tests():
    return [TestCase((2,), 2), TestCase((3,), 3), TestCase((5,), 8)]
PROBLEM_BANK: dict[str, Problem] = {'two-sum': Problem(slug='two-sum', title='Two Sum', difficulty='Easy', description='Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.', function_name='two_sum', starter_code='def two_sum(nums, target):\n    pass\n', test_cases=_two_sum_tests(), reference_solution='def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i\n    return []\n'), 'reverse-linked-list': Problem(slug='reverse-linked-list', title='Reverse Linked List (as array)', difficulty='Easy', description='Given a list representing a singly linked list, return it reversed.', function_name='reverse_linked_list', starter_code='def reverse_linked_list(values):\n    pass\n', test_cases=_reverse_linked_list_tests(), reference_solution='def reverse_linked_list(values):\n    return values[::-1]\n'), 'valid-parentheses': Problem(slug='valid-parentheses', title='Valid Parentheses', difficulty='Easy', description='Given a string containing just brackets, determine if the input string is valid.', function_name='is_valid', starter_code='def is_valid(s):\n    pass\n', test_cases=_valid_parentheses_tests(), reference_solution="def is_valid(s):\n    pairs = {')': '(', ']': '[', '}': '{'}\n    stack = []\n    for ch in s:\n        if ch in pairs:\n            if not stack or stack.pop() != pairs[ch]:\n                return False\n        else:\n            stack.append(ch)\n    return not stack\n"), 'max-subarray': Problem(slug='max-subarray', title='Maximum Subarray', difficulty='Medium', description='Given an integer array nums, find the contiguous subarray with the largest sum and return its sum.', function_name='max_sub_array', starter_code='def max_sub_array(nums):\n    pass\n', test_cases=_max_subarray_tests(), reference_solution='def max_sub_array(nums):\n    best = cur = nums[0]\n    for n in nums[1:]:\n        cur = max(n, cur + n)\n        best = max(best, cur)\n    return best\n'), 'climbing-stairs': Problem(slug='climbing-stairs', title='Climbing Stairs', difficulty='Easy', description='You can climb 1 or 2 steps at a time. Given n steps, how many distinct ways can you climb to the top?', function_name='climb_stairs', starter_code='def climb_stairs(n):\n    pass\n', test_cases=_climbing_stairs_tests(), reference_solution='def climb_stairs(n):\n    a, b = 1, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n')}
SAFE_BUILTINS = {'range': range, 'len': len, 'min': min, 'max': max, 'sum': sum, 'sorted': sorted, 'reversed': reversed, 'enumerate': enumerate, 'abs': abs, 'list': list, 'dict': dict, 'set': set, 'tuple': tuple, 'str': str, 'int': int, 'float': float, 'bool': bool, 'zip': zip, 'map': map, 'filter': filter, 'any': any, 'all': all, 'isinstance': isinstance, 'print': print, 'float': float}

def _run_in_process(code: str, function_name: str, test_cases, result_queue):
    outcomes = []
    try:
        namespace = {'__builtins__': SAFE_BUILTINS}
        exec(code, namespace)
        fn: Callable = namespace.get(function_name)
        if fn is None:
            result_queue.put({'ok': False, 'error': f"function '{function_name}' not defined", 'results': []})
            return
        for tc in test_cases:
            try:
                actual = fn(*tc.args)
                passed = actual == tc.expected
                outcomes.append({'input': tc.args, 'expected': tc.expected, 'actual': actual, 'passed': passed})
            except Exception as e:
                outcomes.append({'input': tc.args, 'expected': tc.expected, 'actual': None, 'passed': False, 'error': str(e)})
        result_queue.put({'ok': True, 'results': outcomes})
    except Exception:
        result_queue.put({'ok': False, 'error': traceback.format_exc(limit=2), 'results': []})

def judge_submission(slug: str, code: str, timeout_seconds: float=3.0) -> dict:
    problem = PROBLEM_BANK.get(slug)
    if problem is None:
        return {'ok': False, 'error': f"unknown problem '{slug}'", 'results': []}
    ctx = mp.get_context('spawn')
    queue = ctx.Queue()
    proc = ctx.Process(target=_run_in_process, args=(code, problem.function_name, problem.test_cases, queue))
    proc.start()
    proc.join(timeout_seconds)
    if proc.is_alive():
        proc.terminate()
        proc.join()
        return {'ok': False, 'error': 'time limit exceeded', 'results': []}
    if queue.empty():
        return {'ok': False, 'error': 'execution failed with no output', 'results': []}
    payload = queue.get()
    if payload.get('ok'):
        total = len(payload['results'])
        passed = sum((1 for r in payload['results'] if r['passed']))
        payload['summary'] = f'{passed}/{total} test cases passed'
        payload['all_passed'] = passed == total
    return payload

def list_problems() -> list[dict]:
    return [{'slug': p.slug, 'title': p.title, 'difficulty': p.difficulty} for p in PROBLEM_BANK.values()]

def get_problem(slug: str) -> Optional[Problem]:
    return PROBLEM_BANK.get(slug)
