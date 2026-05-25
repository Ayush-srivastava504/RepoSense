# Hugging Face Model Upload Guide

**How to upload, manage, and share your custom models on Hugging Face Hub.**

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Create Repository](#create-repository)
3. [Upload Models](#upload-models)
4. [Verify Upload](#verify-upload)
5. [Use Models](#use-models)
6. [Best Practices](#best-practices)
7. [Examples](#examples)

---

## Prerequisites

### 1. Create Hugging Face Account

- Go to https://huggingface.co
- Click "Sign Up"
- Create account and verify email

### 2. Create Access Token

1. Go to https://huggingface.co/settings/tokens
2. Click "New token"
3. Set name: "RepoSense"
4. Set access: "Write"
5. Copy token

### 3. Install CLI and Authenticate

```bash
# Install huggingface_hub
pip install huggingface-hub

# Authenticate (paste token when prompted)
huggingface-cli login
```

Verify:
```bash
huggingface-cli whoami
# Should show: "You are already logged in as: [your-username]"
```

---

## Create Repository

### Via Web UI (Easiest)

1. Go to https://huggingface.co/new
2. Fill in repository name (e.g., `my-codebert`)
3. Select "Model" as repository type
4. Choose "Private" or "Public"
5. Click "Create repository"

### Via CLI

```bash
# List existing repos
huggingface-cli list-repo-files myorg/my-model

# Or create via web UI and use immediately
```

---

## Upload Models

### Option 1: Automated Script (Recommended)

Use the provided upload utility:

```bash
# Upload CodeBERT model
python scripts/upload_model_to_hf.py \
  --type codebert \
  --local-path ./services/api/models/codebert_quantized \
  --repo myorg/my-codebert

# Upload Qwen GGUF model
python scripts/upload_model_to_hf.py \
  --type qwen-gguf \
  --local-path ./model.gguf \
  --repo myorg/my-qwen

# Upload generic files
python scripts/upload_model_to_hf.py \
  --type generic \
  --local-path ./my-models \
  --repo myorg/my-models
```

### Option 2: HuggingFace CLI

```bash
# Upload a single file
huggingface-cli upload myorg/my-codebert \
  ./local/model.bin \
  model.bin

# Upload entire directory
huggingface-cli upload myorg/my-codebert \
  ./local/codebert_quantized \
  --repo-type model
```

### Option 3: Python API

```python
from huggingface_hub import HfApi, create_repo
from pathlib import Path

api = HfApi()
repo_id = "myorg/my-codebert"

# Create repo if needed
create_repo(repo_id, exist_ok=True)

# Upload files
for file_path in Path("./codebert_quantized").rglob("*"):
    if file_path.is_file():
        relative_path = file_path.relative_to("./codebert_quantized")
        api.upload_file(
            path_or_fileobj=str(file_path),
            path_in_repo=str(relative_path),
            repo_id=repo_id,
            repo_type="model",
        )

print(f"✅ Uploaded to https://huggingface.co/{repo_id}")
```

---

## Verify Upload

### Check Repository

```bash
# List files in repository
huggingface-cli list-repo-files myorg/my-codebert

# View specific file
huggingface-cli repo-files-info myorg/my-codebert --token $HF_TOKEN
```

### Visit Web

- Go to `https://huggingface.co/myorg/my-codebert`
- Should see all files listed
- Can preview text files

---

## Use Models

### In RepoSense

Update `.env`:

```env
# Use your custom CodeBERT
CODEBERT_MODEL=myorg/my-codebert

# Or use your custom Qwen
HF_MODEL_REPO=myorg/my-qwen
HF_MODEL_FILE=qwen2-0.5b-instruct.Q4_K_M.gguf

MODEL_CACHE_DIR=.model_cache
```

Start application:
```bash
python services/app.py
```

Models download from your HF repository.

### In Other Projects

```python
from transformers import AutoModel, AutoTokenizer

# Load CodeBERT from your repo
model = AutoModel.from_pretrained("myorg/my-codebert")
tokenizer = AutoTokenizer.from_pretrained("myorg/my-codebert")

# Or via CLI
from huggingface_hub import hf_hub_download

model_path = hf_hub_download(
    repo_id="myorg/my-qwen",
    filename="qwen2-0.5b-instruct.Q4_K_M.gguf"
)
```

---

## Best Practices

### 1. Model Card

Add `README.md` to your repository:

```markdown
# My CodeBERT Model

Custom fine-tuned CodeBERT for [your purpose].

## Usage

\`\`\`python
from transformers import AutoModel, AutoTokenizer

model = AutoModel.from_pretrained("myorg/my-codebert")
tokenizer = AutoTokenizer.from_pretrained("myorg/my-codebert")
\`\`\`

## Training Data

Trained on [description]

## Performance

- Accuracy: 95%
- F1 Score: 0.94

## License

[Your License]
```

### 2. Organize Files

```
my-codebert/
├── README.md              # Model description
├── config.json            # Model config
├── pytorch_model.bin      # Model weights
├── tokenizer.json         # Tokenizer
├── vocab.json             # Vocabulary
└── training_args.json     # Training info
```

### 3. Versioning

Use git tags for versions:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Or create separate repos for versions:
- `myorg/codebert-v1`
- `myorg/codebert-v2`

### 4. Licensing

Specify license in repository settings:
- Go to repository settings
- Select appropriate license
- Examples: MIT, Apache 2.0, CC-BY-4.0

### 5. Privacy

For proprietary models:
- Set repository to "Private"
- Only you can access
- Or give specific users access via settings

### 6. Descriptions & Tags

Add model card metadata:

```yaml
---
license: apache-2.0
tags:
- code-analysis
- pytorch
- transformers
datasets:
- your-dataset-name
language:
- code
---

# My CodeBERT Model
...
```

---

## Examples

### Example 1: Upload Fine-Tuned CodeBERT

```bash
# Prepare model directory
cd ~/fine-tuning
ls -la my-codebert/
# config.json, pytorch_model.bin, tokenizer.json, special_tokens_map.json, vocab.json

# Create HF repo
# (via https://huggingface.co/new)

# Upload using script
python scripts/upload_model_to_hf.py \
  --type codebert \
  --local-path ~/fine-tuning/my-codebert \
  --repo myorg/codebert-finetuned

# Verify
huggingface-cli list-repo-files myorg/codebert-finetuned

# Use in RepoSense
export CODEBERT_MODEL=myorg/codebert-finetuned
python services/app.py
```

### Example 2: Upload GGUF Model

```bash
# Download GGUF from somewhere
wget https://example.com/my-model.Q4_K_M.gguf

# Upload
python scripts/upload_model_to_hf.py \
  --type qwen-gguf \
  --local-path ./my-model.Q4_K_M.gguf \
  --repo myorg/my-qwen

# Use in RepoSense
export HF_MODEL_REPO=myorg/my-qwen
export HF_MODEL_FILE=my-model.Q4_K_M.gguf
python services/app.py
```

### Example 3: Share Private Model with Team

```bash
# Create private repository
# Go to https://huggingface.co/new
# Set to Private

# Upload model
python scripts/upload_model_to_hf.py \
  --type codebert \
  --local-path ./codebert \
  --repo myorg/codebert-internal

# Grant access to team members
# Go to https://huggingface.co/myorg/codebert-internal/settings
# Add collaborators with Write permission

# Team members can now use
export CODEBERT_MODEL=myorg/codebert-internal
python services/app.py
```

---

## Advanced

### Auto-Upload via CI/CD

```yaml
# .github/workflows/upload-model.yml
name: Upload Model

on:
  release:
    types: [published]

jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      
      - name: Install dependencies
        run: pip install huggingface-hub
      
      - name: Upload to HF
        run: |
          huggingface-cli login --token ${{ secrets.HF_TOKEN }}
          python scripts/upload_model_to_hf.py \
            --type codebert \
            --local-path ./models/codebert \
            --repo ${{ secrets.HF_REPO }}
```

### Manage Multiple Versions

```bash
# Version 1
export CODEBERT_MODEL=myorg/codebert-v1

# Version 2
export CODEBERT_MODEL=myorg/codebert-v2

# Latest (symlink in README)
export CODEBERT_MODEL=myorg/codebert
# Points to latest version via model card
```

---

## Troubleshooting

### Issue: "Authentication failed"

```bash
huggingface-cli login
# Re-enter token
```

### Issue: "Repository not found"

```bash
# Verify exists
huggingface-cli list-repo-files myorg/my-model

# Or create first via web UI
```

### Issue: "Permission denied"

```bash
# Check token has write access
huggingface-cli token-cls WRITE

# Recreate token with WRITE permission
```

### Issue: "Upload timeout"

```bash
# Use CLI with retry
huggingface-cli upload myorg/my-model ./file \
  --retry 5
```

---

## Related

- [Hugging Face Hub Documentation](https://huggingface.co/docs/hub)
- [Model Upload Guide](https://huggingface.co/docs/hub/adding-a-model)
- [Repository Settings](https://huggingface.co/docs/hub/repositories-settings)

---

**Ready to share your models? Create a repository and upload!** 
