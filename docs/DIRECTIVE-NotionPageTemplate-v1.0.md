# DIRECTIVE: Notion Page Template System v1.0

**Layer:** Strategic (no local access)
**Target:** Coding agent with repository access
**Artifact Type:** DIRECTIVE → feeds into `/craft`

---

## Strategic Intent

Build a complete page template system for Notion publishing that ensures every blog post follows a consistent structure with proper header, content formatting, and footer.

---

## The Problem

Current publishing creates pages with:
- Inconsistent navigation placement
- Missing dates
- No footer
- No similar posts linking
- No standard structure agents can follow

---

## The Solution

A template system consisting of:

1. **Header block generator** - Navigation + spacers + title + date
2. **Footer block generator** - Bio, social links, similar posts
3. **Similar posts linker** - Query database, filter by tags, inject links
4. **Essay refiner sub-agent** - Transform ideas into accessible prose

---

## Header Structure (Required)

Based on reference: https://uxrouter.notion.site/What-People-Miss-About-Canvas-28552116a8b1802d96a4c45d61115181

```
Block 1:  paragraph    "[**← Go back**](https://www.notion.so/Rashid-Azarang-86c9f77657a2461ba3e5f2d8fccdcf04?pvs=21)"
Block 2:  paragraph    {empty}
Block 3:  paragraph    {empty}
Block 4:  heading_2    "{POST_TITLE}"
Block 5:  paragraph    "**Date:** {DATE}"
Block 6:  paragraph    {empty}
Block 7:  paragraph    "{HOOK_PARAGRAPH}"
...
```

### Navigation Link Format

Exact format (bold, internal link):
```json
{
  "type": "paragraph",
  "paragraph": {
    "rich_text": [{
      "type": "text",
      "text": {
        "content": "← Go back",
        "link": {"url": "https://www.notion.so/Rashid-Azarang-86c9f77657a2461ba3e5f2d8fccdcf04?pvs=21"}
      },
      "annotations": {"bold": true}
    }]
  }
}
```

### Date Format

```json
{
  "type": "paragraph",
  "paragraph": {
    "rich_text": [{
      "type": "text",
      "text": {"content": "Date: "},
      "annotations": {"bold": true}
    }, {
      "type": "text",
      "text": {"content": "{FORMATTED_DATE}"}
    }]
  }
}
```

Where `{FORMATTED_DATE}` = "January 2, 2026" (Month Day, Year)

---

## Footer Structure (Required)

Based on reference. Insert after final content paragraph:

```
Block N:    divider
Block N+1:  paragraph    "A mix of what's on my mind, what I'm learning, and what I'm going through."
Block N+2:  paragraph    {empty}
Block N+3:  paragraph    "**Co-created with AI. 🤖**"
Block N+4:  divider
Block N+5:  heading_2    "More about me"
Block N+6:  paragraph    "{BIO_TEXT}"
Block N+7:  paragraph    {empty}
Block N+8:  paragraph    "[**About me →**](https://rashidazarang.com/personal)"
Block N+9:  divider
Block N+10: heading_2    "Similar blog posts"
Block N+11: link_to_page {SIMILAR_POST_1}
Block N+12: link_to_page {SIMILAR_POST_2} (optional)
Block N+13: link_to_page {SIMILAR_POST_3} (optional)
Block N+14: divider
Block N+15: paragraph    "**Social**"
Block N+16: paragraph    "[X](https://twitter.com/rashidazarang)"
Block N+17: paragraph    "[Youtube](https://www.youtube.com/@RashidAzarang)"
Block N+18: paragraph    "[Behance](https://www.behance.net/rashidazarang_)"
Block N+19: paragraph    "[Medium](https://medium.com/@rashidazarang)"
Block N+20: paragraph    "**Contact**"
Block N+21: paragraph    "[Linkedin](https://www.linkedin.com/in/rashidazarang/)"
Block N+22: paragraph    "[Schedule a Call](https://secure.paperworkflows.com/meet-rashid)"
Block N+23: paragraph    "[Email](mailto:rashid.azarang.eg@gmail.com?subject=Interest%20in%20your%20services&body=...)"
Block N+24: paragraph    "**Resources**"
Block N+25: paragraph    "[Github](https://github.com/rashidazarang/)"
Block N+26: paragraph    "[Press](https://www.notion.so/Press-e759ab184bb14a6c9dc755c4afe96f7c?pvs=21)"
Block N+27: paragraph    "[Sitemap](https://rashidazarang.com/sitemap.xml)"
Block N+28: paragraph    "[RSS Feed](https://feedmaker.fly.dev/feed/?url=...)"
```

### Bio Text (Static)

```
My aim is to live a balanced and meaningful life, where all areas of my life are in harmony. By living this way, I can be the best version of myself and make a positive difference in the world.

Professionally, I focus on the design and implementation of cognitive infrastructure: systems that make complex enterprise data usable through AI-powered tools and human-like interaction.
```

---

## Similar Posts System

### Query Strategy

When creating a page with tag `{PRIMARY_TAG}`:

1. Query database for pages where:
   - `Tags` contains `{PRIMARY_TAG}`
   - `id` != current page id
   - `Status` = "Published" (if exists)
2. Limit to 3 results
3. Order by `Created time` descending
4. Insert as `link_to_page` blocks

### Notion API for Link to Page

```json
{
  "type": "link_to_page",
  "link_to_page": {
    "type": "page_id",
    "page_id": "{SIMILAR_PAGE_ID}"
  }
}
```

### Fallback

If no similar posts found, omit the "Similar blog posts" section entirely.

---

## Essay Refiner Sub-Agent

### Purpose

Transform raw ideas into accessible, first-principles prose.

### Input

Raw concept text (like the meta-layer discussion)

### Output

Refined essay following MODULE-Text.md guidelines:
- Natural, light tone
- First principles extraction
- Accessible language
- Rhythm variation (punch, standard, extended)

### Transformation Rules

| From | To |
|------|-----|
| Technical jargon | Plain language with example |
| Abstract concept | Concrete metaphor |
| Passive voice | Active voice |
| Long sentences | Varied rhythm |
| Explaining the pattern | Showing the pattern |

### Example Transformation

**Before:**
```
The planning agent doesn't have access to your filesystem. It can't see
your directory structure, can't read your existing code, can't know what
patterns you've already established.
```

**After:**
```
I can't see your code. Not the directory structure, not the existing
patterns, not what you've already built. I'm designing a building I've
never visited.
```

Key changes:
- First person (more immediate)
- Shorter sentences
- Concrete metaphor at end
- Removed repetition

---

## Deliverables for Coding Agent

### 1. Tool: `tools/notion-build-header.py`

```python
def build_header(title: str, date: str) -> list:
    """Returns list of Notion blocks for page header."""
    # Navigation link
    # Empty paragraphs (x2)
    # H2 title
    # Date paragraph
    # Empty paragraph
```

### 2. Tool: `tools/notion-build-footer.py`

```python
def build_footer(database_id: str, current_page_id: str, primary_tag: str) -> list:
    """Returns list of Notion blocks for page footer including similar posts."""
    # Query similar posts
    # Build divider + bio + similar posts + social links
```

### 3. Tool: `tools/notion-get-similar-posts.py`

```python
def get_similar_posts(database_id: str, exclude_id: str, tag: str, limit: int = 3) -> list:
    """Query database for similar posts by tag."""
```

### 4. Sub-Agent: `.claude/agents/essay-refiner.md`

```yaml
---
name: essay-refiner
description: Transform raw ideas into accessible, first-principles prose
tools: Read
model: sonnet
---

You refine essays to be natural, light, and accessible.
Focus on first principles. Show, don't explain.
...
```

### 5. Updated: `tools/notion-create-page.sh`

Add flags:
- `--with-header` - Include standard header with navigation + date
- `--with-footer` - Include standard footer
- `--similar-by-tag TAG` - Query and insert similar posts

### 6. Documentation: `docs/notion-publishing/MODULE-PageStructure.md`

Document the complete page structure with header, body, footer specifications.

---

## Integration with Existing Skill

```
┌─────────────────────────────────────────────────────────┐
│              NOTION PUBLISHING SKILL                    │
│                                                         │
│  Input: Essay content, title, tags                      │
└────────────────────────┬────────────────────────────────┘
                         │
       ┌─────────────────┼─────────────────┐
       ▼                 ▼                 ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│essay-refiner │ │image-prompt- │ │ build-header │
│  sub-agent   │ │  generator   │ │    tool      │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│Refined prose │ │ DALL-E image │ │Header blocks │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       └────────────────┼────────────────┘
                        ▼
               ┌──────────────┐
               │ build-footer │
               │     tool     │
               └──────┬───────┘
                      ▼
               ┌──────────────┐
               │ Notion API   │
               │ Create Page  │
               └──────────────┘
```

---

## Success Criteria

1. Every published page has:
   - Navigation link in exact format
   - Two empty paragraphs after navigation
   - H2 title
   - Date below title
   - Complete footer with bio, similar posts, social links

2. Similar posts correctly filtered by primary tag

3. Essay refiner produces accessible, first-principles prose

4. Tools are composable and work independently

---

## What I Don't Know (Local Agent Must Audit)

- Current state of `tools/notion-create-page.sh`
- Exact database property names for filtering
- Whether `link_to_page` block type is supported in current Notion API version
- Existing patterns in the codebase I should follow

---

## Lineage

This DIRECTIVE originates from conversation about:
- Meta-layer abstraction patterns
- Architect vs contractor mode
- Strategic → tactical translation

The essay being refined captures this concept. The page template ensures consistent publishing. The similar posts system creates content threading.

---

*This is strategic intent. The local agent audits ground truth and executes via `/craft`.*
