# Model Setup - Quick Start Guide

**Status: Hugging Face Migration Complete**

This guide gets you up and running with RepoSense's new Hugging Face model system in 5 minutes.

---

## Quick Start (Recommended)

### Interactive Setup Wizard

The easiest way to configure everything automatically:

```bash
python scripts/setup_models.py
```

This wizard will:
1. ✅ Check dependencies
2. ✅ Configure CodeBERT model
3. ✅ Configure Qwen LLM
4. ✅ Create .env file
5. ✅ Update .gitignore
6. ✅ Optionally download models

**That's it!** Your app is ready to run.

---

## Manual Setup

If you prefer manual configuration:

### 1. Install Dependencies

```bash
pip install transformers huggingface-hub onnxruntime optimum[onnxruntime] llama-cpp-python
```

### 2. Login to Hugging Face (Optional)

For private models:

```bash
huggingface-cli login
# Paste your token when prompted
```

### 3. Create `.env` File

```bash
# .env file in repository root
CODEBERT_MODEL=microsoft/codebert-base
HF_MODEL_REPO=TheBloke/Qwen2-0.5B-Instruct-GGUF
HF_MODEL_FILE=qwen2-0.5b-instruct.Q4_K_M.gguf
MODEL_CACHE_DIR=.model_cache
```

### 4. Start the App

```bash
python services/app.py
```

Models will download automatically on first run (~500MB total).

---

## Docker Deployment

```bash
docker-compose up -d
```

Models are automatically downloaded and cached. Perfect for CI/CD!

---

## Default Models

| Model | Size | Purpose | Provider |
|-------|------|---------|----------|
| **CodeBERT** | ~500MB | Code Analysis | microsoft |
| **Qwen 0.5B** | ~300MB | Code Generation | TheBloke |

---

## Next Steps

1. **Run the wizard**: `python scripts/setup_models.py`
2. **Start the app**: `python services/app.py`
3. **Test the API**: Open `http://localhost:8000/docs`
4. **Read full guide**: See `COMPLETE_MODEL_MIGRATION_GUIDE.md`

---

## Tips

- **First run is slow** (downloading models) - subsequent runs are fast
- **Models cached locally** - `.model_cache/` directory
- **Offline mode** - once cached, works without internet
- **Custom models** - use any model from Hugging Face by changing env vars

---

## Troubleshooting

### Issue: "Module not found"
**Solution:** Install dependencies: `pip install transformers huggingface-hub llama-cpp-python`

### Issue: "Model download stuck"
**Solution:** Check internet connection. Models are ~500MB total.

### Issue: "Out of memory"
**Solution:** Qwen uses ~1.5GB RAM. If it crashes, use a smaller model.

### Issue: "HuggingFace API error"
**Solution:** Try `huggingface-cli login` or check your internet connection.

---

## Full Documentation

- **COMPLETE_MODEL_MIGRATION_GUIDE.md** - Deep dive, all details
- **HUGGINGFACE_MODEL_GUIDE.md** - Upload custom models
- **MODEL_CONFIGURATION.md** - Environment variables reference
- **MODEL_MIGRATION_SUMMARY.md** - What changed and why

---

## Need Help?

1. Check the logs: `tail -f logs/app.log`
2. Read the full guide: `COMPLETE_MODEL_MIGRATION_GUIDE.md`
3. Review environment: Run `python -c "import transformers; print(transformers.__version__)"`

---

**Ready to go! Run `python scripts/setup_models.py` now.** 🎉
