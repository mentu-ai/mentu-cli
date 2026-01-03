#!/bin/bash
# Run linters as a baseline before review

set -e

echo "=== Code Review: Linter Check ==="
echo ""

# TypeScript
if [ -f "tsconfig.json" ]; then
  echo "[TypeScript] Checking compilation..."
  if npx tsc --noEmit 2>/dev/null; then
    echo "  ✓ TypeScript compiles"
  else
    echo "  ✗ TypeScript errors found"
    npx tsc --noEmit
  fi
  echo ""
fi

# ESLint
if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f ".eslintrc.yml" ]; then
  echo "[ESLint] Running..."
  if npx eslint . --ext .ts,.tsx,.js,.jsx --quiet 2>/dev/null; then
    echo "  ✓ No ESLint errors"
  else
    echo "  ✗ ESLint errors found"
  fi
  echo ""
fi

# Prettier (check only)
if [ -f ".prettierrc" ] || [ -f ".prettierrc.json" ]; then
  echo "[Prettier] Checking formatting..."
  if npx prettier --check "**/*.{ts,tsx,js,jsx,json}" 2>/dev/null; then
    echo "  ✓ Code formatted correctly"
  else
    echo "  ✗ Formatting issues found"
  fi
  echo ""
fi

# Security: grep for potential secrets
echo "[Security] Scanning for potential secrets..."
SECRETS_FOUND=0

if grep -rn "password\s*=\s*[\"']" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" 2>/dev/null | grep -v "test" | grep -v "spec" | head -5; then
  SECRETS_FOUND=1
fi

if grep -rn "api[_-]?key\s*=\s*[\"']" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" 2>/dev/null | grep -v "test" | grep -v "spec" | head -5; then
  SECRETS_FOUND=1
fi

if grep -rn "secret\s*=\s*[\"']" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" 2>/dev/null | grep -v "test" | grep -v "spec" | head -5; then
  SECRETS_FOUND=1
fi

if [ $SECRETS_FOUND -eq 0 ]; then
  echo "  ✓ No obvious secrets found"
else
  echo "  ✗ Potential secrets detected (review above)"
fi
echo ""

# Performance: grep for common issues
echo "[Performance] Scanning for common issues..."
PERF_ISSUES=0

if grep -rn "readFileSync\|writeFileSync" --include="*.ts" --include="*.js" 2>/dev/null | grep -v "test" | grep -v "spec" | head -3; then
  echo "  ! Sync file operations found"
  PERF_ISSUES=1
fi

if grep -rn "await.*forEach\|for.*await" --include="*.ts" --include="*.js" 2>/dev/null | head -3; then
  echo "  ! Sequential awaits in loops found"
  PERF_ISSUES=1
fi

if [ $PERF_ISSUES -eq 0 ]; then
  echo "  ✓ No obvious performance issues"
fi
echo ""

echo "=== Linter check complete ==="
