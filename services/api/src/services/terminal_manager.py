import asyncio
import os
import pty
import subprocess
import uuid

class TerminalSession:
    def __init__(self, user_id: str, repo_id: str):
        self.user_id = user_id
        self.repo_id = repo_id
        self.session_id = str(uuid.uuid4())
        self.process = None
        self.fd = None

    async def start(self):
        master_fd, slave_fd = pty.openpty()
        self.fd = master_fd
        self.process = await asyncio.create_subprocess_shell(
            "bash -i",
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            shell=True,
            executable="/bin/bash",
            preexec_fn=os.setsid
        )
        return self

    async def write(self, data: str):
        if self.fd:
            os.write(self.fd, data.encode())

    async def read(self) -> str:
        if self.fd:
            try:
                return os.read(self.fd, 4096).decode()
            except BlockingIOError:
                return ""
        return ""

    async def stop(self):
        if self.process:
            self.process.terminate()
            await self.process.wait()
        if self.fd:
            os.close(self.fd)