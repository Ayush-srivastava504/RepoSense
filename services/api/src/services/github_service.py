import httpx


class GithubService:

    def __init__(self, token: str):

        self.headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
        }

        self.timeout = httpx.Timeout(
            60.0,
            connect=30.0,
        )

    async def get_user(self):

        async with httpx.AsyncClient(
            timeout=self.timeout
        ) as client:

            resp = await client.get(
                "https://api.github.com/user",
                headers=self.headers,
            )

            resp.raise_for_status()

            return resp.json()

    async def get_repos(self):

        async with httpx.AsyncClient(
            timeout=self.timeout
        ) as client:

            resp = await client.get(
                "https://api.github.com/user/repos",
                headers=self.headers,
            )

            resp.raise_for_status()

            return resp.json()