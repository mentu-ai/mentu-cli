#!/bin/bash
# Create GitHub labels for UTL

GITHUB_TOKEN="${GITHUB_TOKEN:-your_token_here}"
REPO="rashidazarang/tickets"

create_label() {
  local name="$1"
  local color="$2"
  local description="$3"

  response=$(curl -s -w "%{http_code}" -o /tmp/label_response.json -X POST \
    "https://api.github.com/repos/$REPO/labels" \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$name\",\"color\":\"$color\",\"description\":\"$description\"}")

  if [ "$response" = "201" ]; then
    echo "✓ Created: $name"
  elif [ "$response" = "422" ]; then
    echo "• Exists: $name"
  else
    echo "✗ Failed: $name (HTTP $response)"
  fi
}

echo "Creating GitHub labels in $REPO..."
echo ""

# Type labels
create_label "bug" "d73a4a" "Something isnt working"
create_label "enhancement" "a2eeef" "New feature or request"
create_label "support" "7057ff" "Customer support request"
create_label "task" "0075ca" "General task or to-do"
create_label "question" "d876e3" "Further information is requested"

# Source labels
create_label "user-reported" "fbca04" "Submitted via Bug Reporter UI"
create_label "source: api" "ededed" "Submitted via API"
create_label "source: email" "ededed" "Submitted via email"
create_label "source: slack" "ededed" "Submitted via Slack"

# Priority labels
create_label "priority: critical" "b60205" "Critical priority - immediate action"
create_label "priority: high" "d93f0b" "High priority"
create_label "priority: medium" "fbca04" "Medium priority"
create_label "priority: low" "0e8a16" "Low priority"

echo ""
echo "Done!"
