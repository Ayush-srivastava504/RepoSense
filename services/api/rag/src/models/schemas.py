from pydantic import BaseModel
from typing import List

class FileContent(BaseModel):
    path: str
    content: str

class IndexRequest(BaseModel):
    repo_name: str
    files: List[FileContent]

class GenerateRequest(BaseModel):
    repo_name: str
    prompt: str = "Generate a comprehensive README.md file for this repository"

class GenerateResponse(BaseModel):
    readme: str
    used_chunks: int