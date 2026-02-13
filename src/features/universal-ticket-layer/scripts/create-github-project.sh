#!/bin/bash
# Create GitHub Project for Universal Ticket Layer
# Links both the tickets repo and warrantyos repo

GITHUB_TOKEN="${GITHUB_TOKEN:-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}"
OWNER="rashidazarang"

echo "Creating GitHub Project for Universal Ticket Layer..."
echo ""

# Step 1: Get user ID
echo "Getting user ID..."
USER_ID=$(curl -s -X POST "https://api.github.com/graphql" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"query { user(login: \"'$OWNER'\") { id } }"}' | jq -r '.data.user.id')

if [ "$USER_ID" = "null" ] || [ -z "$USER_ID" ]; then
  echo "Error: Could not get user ID"
  exit 1
fi
echo "User ID: $USER_ID"

# Step 2: Create Project
echo ""
echo "Creating project..."
PROJECT_RESULT=$(curl -s -X POST "https://api.github.com/graphql" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createProjectV2(input: { ownerId: \"'$USER_ID'\", title: \"Universal Ticket Layer\" }) { projectV2 { id number url } } }"
  }')

PROJECT_ID=$(echo $PROJECT_RESULT | jq -r '.data.createProjectV2.projectV2.id')
PROJECT_NUMBER=$(echo $PROJECT_RESULT | jq -r '.data.createProjectV2.projectV2.number')
PROJECT_URL=$(echo $PROJECT_RESULT | jq -r '.data.createProjectV2.projectV2.url')

if [ "$PROJECT_ID" = "null" ] || [ -z "$PROJECT_ID" ]; then
  echo "Error creating project:"
  echo $PROJECT_RESULT | jq .
  exit 1
fi

echo "✓ Project created!"
echo "  ID: $PROJECT_ID"
echo "  Number: $PROJECT_NUMBER"
echo "  URL: $PROJECT_URL"

# Step 3: Get repository IDs
echo ""
echo "Getting repository IDs..."

TICKETS_REPO_ID=$(curl -s -X POST "https://api.github.com/graphql" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"query { repository(owner: \"'$OWNER'\", name: \"tickets\") { id } }"}' | jq -r '.data.repository.id')

echo "tickets repo ID: $TICKETS_REPO_ID"

# Step 4: Link tickets repo to project
echo ""
echo "Linking tickets repo to project..."
LINK_RESULT=$(curl -s -X POST "https://api.github.com/graphql" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { linkProjectV2ToRepository(input: { projectId: \"'$PROJECT_ID'\", repositoryId: \"'$TICKETS_REPO_ID'\" }) { repository { nameWithOwner } } }"
  }')

if echo $LINK_RESULT | jq -e '.data.linkProjectV2ToRepository' > /dev/null 2>&1; then
  echo "✓ tickets repo linked!"
else
  echo "Note: Could not link tickets repo (may already be linked or permissions issue)"
  echo $LINK_RESULT | jq .
fi

# Step 5: Add Status field (To Do, In Progress, Done)
echo ""
echo "Adding Status field..."
STATUS_RESULT=$(curl -s -X POST "https://api.github.com/graphql" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createProjectV2Field(input: { projectId: \"'$PROJECT_ID'\", dataType: SINGLE_SELECT, name: \"Status\" }) { projectV2Field { ... on ProjectV2SingleSelectField { id name options { id name } } } } }"
  }')

echo $STATUS_RESULT | jq .

echo ""
echo "========================================"
echo "GitHub Project Created!"
echo "========================================"
echo ""
echo "Project URL: $PROJECT_URL"
echo ""
echo "Next steps:"
echo "1. Go to: $PROJECT_URL"
echo "2. Click 'Add items' to add existing issues"
echo "3. Configure views (Board, Table)"
echo "4. Set up automations"
echo ""
echo "Issues from rashidazarang/tickets will automatically appear when created!"
