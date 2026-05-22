from typing import List, Dict

class CodeChunker:
    @staticmethod
    def chunk_file(content: str, file_path: str, max_chars: int = 1500) -> List[Dict]:
        chunks = []
        lines = content.split('\n')
        current_chunk = []
        current_length = 0

        for line_num, line in enumerate(lines, 1):
            line_len = len(line)
            if current_length + line_len > max_chars and current_chunk:
                chunks.append({
                    "path": file_path,
                    "text": "\n".join(current_chunk),
                    "start_line": line_num - len(current_chunk)
                })
                current_chunk = []
                current_length = 0
            current_chunk.append(line)
            current_length += line_len

        if current_chunk:
            chunks.append({
                "path": file_path,
                "text": "\n".join(current_chunk),
                "start_line": len(lines) - len(current_chunk) + 1
            })
        return chunks