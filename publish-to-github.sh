#!/bin/bash

# ====================================================
# GitHub Publishing Script for StainHub Automation
# ====================================================

set -e  # Exit on error

echo "🚀 Starting GitHub Publishing Process..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Repository details
REPO_URL="https://github.com/Sashisweb/StainHub.git"
BRANCH="main"

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check if git is installed
if ! command -v git &> /dev/null; then
    print_error "Git is not installed. Please install Git first."
    exit 1
fi

print_success "Git is installed"

# Check if in a git repository
if [ ! -d .git ]; then
    print_info "Initializing Git repository..."
    git init
    print_success "Git repository initialized"
else
    print_info "Git repository already exists"
fi

# Verify .gitignore exists
if [ ! -f .gitignore ]; then
    print_error ".gitignore file not found"
    exit 1
fi

print_success ".gitignore file exists"

# Check for sensitive files
if [ -f .env ]; then
    if grep -q "^.env$" .gitignore; then
        print_success ".env is in .gitignore (safe)"
    else
        print_error ".env exists but not in .gitignore! Add it before pushing."
        exit 1
    fi
fi

# Check if localstorage.json is excluded
if [ -f localstorage.json ]; then
    if grep -q "localstorage.json" .gitignore; then
        print_success "localstorage.json is in .gitignore (safe)"
    else
        print_error "localstorage.json exists but not in .gitignore! Add it before pushing."
        exit 1
    fi
fi

# Stage all files
print_info "Staging all files..."
git add .
print_success "Files staged"

# Check if there are changes to commit
if git diff --cached --quiet; then
    print_info "No changes to commit"
else
    # Commit changes
    print_info "Creating commit..."
    
    # Prompt for commit message
    echo ""
    echo "Enter commit message (or press Enter for default):"
    read -r COMMIT_MSG
    
    if [ -z "$COMMIT_MSG" ]; then
        COMMIT_MSG="feat: Complete Playwright automation framework

- Implemented Page Object Model for all modules
- Added E2E test suite covering Login → Models → Upload → Activity → Reports
- Created reusable fixtures for test setup
- Added network logging utility
- Configured GitHub Actions CI/CD pipeline
- Added comprehensive test coverage"
    fi
    
    git commit -m "$COMMIT_MSG"
    print_success "Commit created"
fi

# Check if remote exists
if git remote | grep -q "^origin$"; then
    print_info "Remote 'origin' already exists"
    
    # Verify remote URL
    CURRENT_URL=$(git remote get-url origin)
    if [ "$CURRENT_URL" != "$REPO_URL" ]; then
        print_info "Updating remote URL..."
        git remote set-url origin "$REPO_URL"
        print_success "Remote URL updated"
    fi
else
    print_info "Adding remote 'origin'..."
    git remote add origin "$REPO_URL"
    print_success "Remote added"
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    print_info "Creating/switching to $BRANCH branch..."
    git branch -M "$BRANCH"
fi

# Push to GitHub
print_info "Pushing to GitHub..."
echo ""
echo "⚠️  You may be prompted for GitHub credentials"
echo "   Use your GitHub username and Personal Access Token (PAT)"
echo ""

if git push -u origin "$BRANCH"; then
    print_success "Successfully pushed to GitHub!"
    echo ""
    echo "🎉 Your code is now on GitHub: $REPO_URL"
    echo ""
    echo "Next steps:"
    echo "1. Visit https://github.com/Sashisweb/StainHub"
    echo "2. Verify all files are uploaded"
    echo "3. Check GitHub Actions tab for CI/CD workflow"
    echo "4. Add repository secrets (EMAIL, PASSWORD, BASE_URL)"
else
    print_error "Failed to push to GitHub"
    echo ""
    echo "Common solutions:"
    echo "1. Check your GitHub credentials"
    echo "2. Generate a Personal Access Token (PAT) at:"
    echo "   https://github.com/settings/tokens"
    echo "3. Use PAT as password when prompted"
    echo "4. Run: git push -u origin $BRANCH"
    exit 1
fi

# Summary
echo ""
echo "================================================"
echo "📊 Repository Status:"
echo "================================================"
git log --oneline -5
echo ""
git remote -v
echo ""
print_success "All done! 🚀"