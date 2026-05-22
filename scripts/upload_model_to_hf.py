#!/usr/bin/env python

import argparse
import sys
from pathlib import Path


def ensure_repo(api, repo_id: str):
    try:
        api.get_repo_info(repo_id)
        print(f"Repository exists: {repo_id}")
    except Exception:
        print(f"Creating repository: {repo_id}")
        from huggingface_hub import create_repo

        create_repo(repo_id, exist_ok=True)


def upload_single_file(api, file_path: Path, repo_id: str, path_in_repo: str):
    print(f"Uploading: {path_in_repo}")

    api.upload_file(
        path_or_fileobj=str(file_path),
        path_in_repo=path_in_repo,
        repo_id=repo_id,
        repo_type="model",
    )


def upload_directory(api, local_path: Path, repo_id: str):
    for file_path in local_path.rglob("*"):
        if file_path.is_file():
            relative_path = file_path.relative_to(local_path)

            upload_single_file(
                api,
                file_path,
                repo_id,
                str(relative_path),
            )


def upload_model(local_path: str, repo_id: str):
    try:
        from huggingface_hub import HfApi

        local_path = Path(local_path)

        if not local_path.exists():
            print(f"Path not found: {local_path}")
            return False

        api = HfApi()

        ensure_repo(api, repo_id)

        if local_path.is_file():
            upload_single_file(
                api,
                local_path,
                repo_id,
                local_path.name,
            )
        else:
            upload_directory(
                api,
                local_path,
                repo_id,
            )

        print(f"Uploaded successfully: https://huggingface.co/{repo_id}")

        return True

    except Exception as e:
        print(f"Upload failed: {e}")
        return False


def parse_args():
    parser = argparse.ArgumentParser(
        description="Upload models to Hugging Face Hub"
    )

    parser.add_argument(
        "--local-path",
        required=True,
        help="Model file or directory path",
    )

    parser.add_argument(
        "--repo",
        required=True,
        help="Hugging Face repo id",
    )

    return parser.parse_args()


def check_dependencies():
    try:
        import huggingface_hub
    except ImportError:
        print("Install dependency: pip install huggingface-hub")
        sys.exit(1)


def main():
    check_dependencies()

    args = parse_args()

    success = upload_model(
        args.local_path,
        args.repo,
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()