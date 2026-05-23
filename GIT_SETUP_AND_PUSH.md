# 📦 Git Setup & Push – Step‑by‑Step Guide

```markdown
# 📦 Git Setup & Push – Step‑by‑Step Guide

This guide walks you through everything you need to **initialize a Git repository**, **link it to your GitHub repo** (`https://github.com/El3tar-cmd/cli-app`), and **push all changes** in one go.  
It works on macOS, Linux, and Windows (Git Bash / PowerShell).

---

## 1️⃣ Prerequisites

| Requirement | How to verify / install |
|-------------|--------------------------|
| **Git** | `git --version` → should be ≥ 2.30. <br>Install: <br>• macOS: `brew install git` <br>• Linux: `sudo apt-get install git` <br>• Windows: download from https://git-scm.com |
| **Node / npm** (already present for this project) | `node -v` & `npm -v` |
| **GitHub account** | You already have `El3tar-cmd` |
| **Personal Access Token (PAT)** with **`repo`** scope (for HTTPS auth) **or** an **SSH key** (for password‑less auth) – see sections 2‑A & 2‑B. |

---

## 2️⃣ Authentication Options

### A️⃣ HTTPS + PAT (quick & portable)

1. **Create a PAT**  
   1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**.  
   2. Click **Generate new token → Classic**.  
   3. Give it a name (e.g., `cli‑app‑push‑token`).  
   4. **Select the `repo` scope** (full control of public repos).  
   5. Click **Generate token** and **copy** the token (you’ll never see it again).

2. **Configure a credential helper** (stores the token securely so you don’t type it each push).  
   ```bash
   # macOS (Keychain)
   git config --global credential.helper osxkeychain

   # Windows (Git Credential Manager Core)
   git config --global credential.helper manager-core

   # Linux (cache in memory for 15 min) – optional
   git config --global credential.helper cache
   ```
   *If you prefer a plain‑text file (less secure):*  
   ```bash
   git config --global credential.helper store
   ```

### B️⃣ SSH Keys (once‑off, password‑less forever)

1. **Generate an SSH key** (skip if you already have `~/.ssh/id_ed25519`):
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   # Press ENTER to accept default location, optionally set a passphrase.
   ```

2. **Add the public key to GitHub**  
   ```bash
   cat ~/.ssh/id_ed25519.pub   # copy the output
   ```
   - In GitHub: **Settings → SSH and GPG keys → New SSH key** → paste → **Add SSH key**.

3. **Test the connection**  
   ```bash
   ssh -T git@github.com
   # Expected: "Hi El3tar-cmd! You've successfully authenticated..."
   ```

---

## 3️⃣ Initialise / Verify the Local Repository

> The project already contains a `.git/` folder, but the steps below work whether it’s a fresh folder or an existing repo.

```bash
# 1️⃣ Move to the project root (where package.json lives)
cd /path/to/nova-cli   # <-- adjust to your actual path

# 2️⃣ Ensure Git is tracking the folder
git status   # should show “On branch main” or “nothing to commit”

# If the folder isn’t a repo yet:
# git init
```

### Optional: Set the default branch to `main`

```bash
git branch -M main   # rename current branch to main (if not already)
```

---

## 4️⃣ Add the Remote (GitHub repo)

### A️⃣ Using HTTPS (PAT)

```bash
git remote add origin https://github.com/El3tar-cmd/cli-app.git
```

### B️⃣ Using SSH

```bash
git remote add origin git@github.com:El3tar-cmd/cli-app.git
```

*If a remote named `origin` already exists and points elsewhere, replace it:*  

```bash
git remote set-url origin <new‑url>
```

---

## 5️⃣ Stage & Commit All Changes

```bash
# Stage everything (including new files, deletions, etc.)
git add -A

# Create a commit (feel free to edit the message)
git commit -m "chore: initial commit of nova‑cli project"
```

> If you already have commits and just want to push the latest state, you can skip the `git add/commit` step.

---

## 6️⃣ Push to GitHub (one‑time authentication)

```bash
git push -u origin main
```
- **First push** will prompt for credentials:  
  - **Username:** `El3tar-cmd` (or your GitHub username)  
  - **Password:** paste the **PAT** you generated (if using HTTPS)  
    *or* your SSH passphrase (if you set one).

- After the credential helper stores the token, **future pushes** are simply:  

```bash
git push
```

---

## 7️⃣ Verify the Push

1. Open the repo in a browser: <https://github.com/El3tar-cmd/cli-app>  
2. You should see all source files, `README.md`, `package.json`, etc., on the `main` branch.

---

## 8️⃣ (Optional) Set Up a Global Git Identity

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

---

## 9️⃣ Quick Reference Cheat‑Sheet

| Action | Command |
|--------|----------|
| **Init repo** | `git init` |
| **Add remote (HTTPS)** | `git remote add origin https://github.com/El3tar-cmd/cli-app.git` |
| **Add remote (SSH)** | `git remote add origin git@github.com:El3tar-cmd/cli-app.git` |
| **Stage everything** | `git add -A` |
| **Commit** | `git commit -m "msg"` |
| **Push (first time)** | `git push -u origin main` |
| **Push thereafter** | `git push` |
| **Set credential helper** | `git config --global credential.helper osxkeychain` (macOS) <br> `git config --global credential.helper manager-core` (Windows) |
| **Generate SSH key** | `ssh-keygen -t ed25519 -C "you@example.com"` |
| **Test SSH** | `ssh -T git@github.com` |

---

## 🎉 Done!

You now have a **fully configured Git workflow** that lets you push any future changes with a single `git push`. Keep this file (`GIT_SETUP_AND_PUSH.md`) in the repo for onboarding new contributors or for your own reference.
```