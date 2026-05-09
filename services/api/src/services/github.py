# backend/app/services/integration/github.py
from services.api.src.services.github import Github
from github.Repository import Repository
from typing import List, Dict, Any
import asyncio

class GitHubIntegration:
    
    def __init__(self, token: str):
        self.client = Github(token)
    
    async def review_pr(self, repo_name: str, pr_number: int) -> Dict[str, Any]:
        repo = self.client.get_repo(repo_name)
        pr = repo.get_pull(pr_number)
        
        files = list(pr.get_files())
        reviews = []
        
        for file in files:
            if self._should_review(file.filename):
                content = repo.get_contents(file.filename, ref=pr.head.sha)
                review = await self._analyze_file(content.decoded_content.decode())
                reviews.append({
                    "file": file.filename,
                    "review": review
                })
        
        await self._post_review_comment(pr, reviews)
        
        return {
            "pr_number": pr_number,
            "repo": repo_name,
            "reviews": reviews,
            "status": "completed"
        }
    
    async def create_webhook(self, repo_name: str, webhook_url: str):
        repo = self.client.get_repo(repo_name)
        repo.create_hook(
            "web",
            {
                "url": webhook_url,
                "content_type": "json",
                "events": ["pull_request", "push"],
                "active": True
            }
        )
    
    def _should_review(self, filename: str) -> bool:
        extensions = ['.py', '.cpp', '.js', '.java', '.go']
        return any(filename.endswith(ext) for ext in extensions)
    
    async def _analyze_file(self, content: str) -> Dict[str, Any]:
        from backend.app.services.code_review.orchestrator import ReviewOrchestrator
        orchestrator = ReviewOrchestrator()
        return await orchestrator.review_code(content)
    
    async def _post_review_comment(self, pr, reviews):
        for review in reviews:
            comment = f"## AI Review for {review['file']}\n\n"
            for issue in review['review']['issues']:
                comment += f"- **{issue['severity'].upper()}**: {issue['message']}\n"
                comment += f"  - Suggestion: {', '.join(issue['suggestions'])}\n"
            
            pr.create_issue_comment(comment)