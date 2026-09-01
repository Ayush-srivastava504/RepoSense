import os
import zipfile

ignore_dirs = {
    '.git', 'node_modules', 'node_modules_old', '.next', 
    '__pycache__', '.pytest_cache', 'venv', '.model_cache', '.vscode'
}
ignore_exts = {'.pyc', '.tsbuildinfo', '.log'}

zip_filename = 'RepoSense_i18n_Blogs_SEO_Bundle.zip'

print(f"Creating {zip_filename}...")
count = 0
with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ignore_dirs and not d.startswith('.')]
        for f in files:
            if any(f.endswith(ext) for ext in ignore_exts) or f == zip_filename:
                continue
            filepath = os.path.join(root, f)
            arcname = os.path.relpath(filepath, '.')
            zipf.write(filepath, arcname)
            count += 1

print(f"Successfully archived {count} files into {zip_filename}!")
