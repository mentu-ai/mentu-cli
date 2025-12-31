#!/bin/bash
# Setup GitHub Project auto-add workflow for issues

GITHUB_TOKEN="${GITHUB_TOKEN:-<GITHUB_TOKEN>}"
OWNER="rashidazarang"
REPO="tickets"
PROJECT_NUMBER=2

echo "Setting up auto-add for issues in $OWNER/$REPO to project #$PROJECT_NUMBER..."

# Create a workflow file in the tickets repo to auto-add issues to project
WORKFLOW_CONTENT='name: Auto-add to Project

on:
  issues:
    types: [opened]

jobs:
  add-to-project:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/add-to-project@v0.5.0
        with:
          project-url: https://github.com/users/rashidazarang/projects/2
          github-token: ${{ secrets.PROJECT_TOKEN }}
'

# Check if .github/workflows exists
echo "Creating workflow file..."

WORKFLOW_BASE64=$(echo "$WORKFLOW_CONTENT" | base64)

# Create the workflow file via API
RESULT=$(curl -s -X PUT "https://api.github.com/repos/$OWNER/$REPO/contents/.github/workflows/auto-add-to-project.yml" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d "{
    \"message\": \"Add auto-add to project workflow\",
    \"content\": \"$(echo "$WORKFLOW_CONTENT" | base64 | tr -d '\n')\"
  }")

if echo $RESULT | jq -e '.content' > /dev/null 2>&1; then
  echo "✓ Workflow created!"
  echo "  File: .github/workflows/auto-add-to-project.yml"
else
  echo "Workflow creation result:"
  echo $RESULT | jq .
fi

echo ""
echo "IMPORTANT: You need to add a PROJECT_TOKEN secret to the tickets repo:"
echo "1. Go to: https://github.com/rashidazarang/tickets/settings/secrets/actions"
echo "2. Add new secret: PROJECT_TOKEN = your GitHub token with project scope"
echo ""
echo "Or manually enable auto-add in the project settings:"
echo "1. Go to: https://github.com/users/rashidazarang/projects/2/settings"
echo "2. Under 'Workflows', enable 'Item added to project'"
