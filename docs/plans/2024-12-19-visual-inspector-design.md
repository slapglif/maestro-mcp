# Visual Inspector Agent - Design Document

**Date:** 2024-12-19
**Status:** Approved for Implementation

## Overview

A visual recursive inspection system for mobile app quality testing using Maestro, implementing hermeneutic circle reasoning to analyze UI parts in context of the whole.

## Requirements

| Requirement | Decision |
|-------------|----------|
| Vision Model | Claude Vision (native multimodal) |
| Autonomy Level | Fully autonomous deep crawl |
| Quality Dimensions | Visual consistency + Accessibility + Design system adherence |
| Reasoning Mode | Parallel bidirectional (parts ↔ whole simultaneously) |
| Constraint Management | MCP Resource + Hook injection |

## Architecture

### Agent Loop with Working Memory

The visual inspector operates as an orchestrating agent that:
1. Captures screenshots and UI hierarchies via Maestro MCP tools
2. Analyzes visuals using Claude's native multimodal capability
3. Maintains working memory across screens
4. Builds and revises hypotheses about design patterns
5. Generates a comprehensive quality report

```
┌────────────────────────────────────────────────────────────────┐
│                    Visual Inspector Agent                       │
├────────────────────────────────────────────────────────────────┤
│  Working Memory:                                                │
│  • App Map: discovered screens, transitions                     │
│  • Component Registry: all UI elements seen                     │
│  • Quality Journal: findings per component/screen               │
│  • Hypotheses: tentative design patterns detected               │
│  • Questions Queue: unresolved observations                     │
├────────────────────────────────────────────────────────────────┤
│  Inspection Loop:                                               │
│  while unexplored_screens or unresolved_questions:              │
│    1. CAPTURE: screenshot + hierarchy                           │
│    2. PERCEIVE: Claude Vision → component list                  │
│    3. QUESTION (parallel bidirectional):                        │
│       - Per component: "Is this consistent? Accessible?"        │
│       - Per screen: "Does this cohere as a whole?"              │
│       - Cross-screen: "Does this match Screen X?"               │
│    4. ANSWER: Generate assessments, update memory               │
│    5. HYPOTHESIZE: "This app uses pattern Y"                    │
│    6. NAVIGATE: tap/swipe to discover new screens               │
│    7. REVISE: Does new screen confirm/refute hypotheses?        │
└────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Constraint System (MCP Resource + Hook)

**Resource: `design-system://current`**
```json
{
  "brand": {
    "colors": { "primary": "#1E88E5", "secondary": "#FFC107" },
    "typography": { "heading": "SF Pro Display", "body": "SF Pro Text" },
    "spacing": { "unit": 8, "scale": [4, 8, 16, 24, 32, 48] }
  },
  "accessibility": {
    "min_contrast": 4.5,
    "min_touch_target": 44,
    "require_labels": true
  },
  "discovered_patterns": []
}
```

**Tool: `maestro_update_constraint`**
- path: JSON path (e.g., 'brand.colors.accent')
- value: Value to set
- evidence: Screen/component where discovered

**Hook: `visual-inspector-context`**
- Triggers on: `maestro_screenshot`, `maestro_hierarchy`
- Action: Prepends design-system resource to context

### 2. Visual Attention System

**Attention Loop:**
```
SCAN → FOCUS → INTERROGATE → RELATE → MOVE → (repeat)
```

**Tool: `maestro_focus_region`**
- Input: screenshot_path, region bounds, question
- Output: cropped_image, region_hierarchy, annotated_full

**Tool: `maestro_capture_screen`** (enhanced)
1. Take screenshot
2. Compute perceptual hash (pHash)
3. Check registry for duplicates (hamming distance < 5)
4. If duplicate: return existing screen_id
5. If new: register and return new screen_id

### 3. Screenshot Memory & Deduplication

**Screen Registry Structure:**
```json
{
  "screen_001": {
    "path": "/tmp/inspector/screen_001.png",
    "phash": "a4e3b2c1d5f6...",
    "hierarchy_hash": "md5...",
    "timestamp": "2024-12-19T...",
    "nav_path": ["home", "tap:Settings"],
    "analyzed": true,
    "findings": [...]
  }
}
```

**Tools:**
- `maestro_capture_screen`: Screenshot + dedup + register
- `maestro_compare_screens`: Compare two screen_ids
- `maestro_get_screen_registry`: Return all captured screens
- `maestro_cleanup_session`: Archive report, delete temp files

### 4. Context Management

**Tiered Memory Architecture:**

| Tier | Contents | Size |
|------|----------|------|
| HOT (in-context) | Current screen, last 2 analyzed, active hypotheses | ~4K tokens |
| WARM (MCP resource) | Screen registry, constraints, cumulative findings | Read on demand |
| COLD (filesystem) | All screenshots, per-screen findings, report draft | Persistent |

**Context Refresh Protocol (every 5 screens):**
1. CHECKPOINT: Write state to warm/cold storage
2. SUMMARIZE: Compress findings
3. RELOAD: Read fresh from MCP resources
4. REORIENT: State current position

### 5. Subagent & Skill Orchestration

Visual Inspector delegates to:

| Component | Type | Purpose |
|-----------|------|---------|
| flow-generator | Subagent | Generate test flows from findings |
| test-analyzer | Subagent | Analyze test failures |
| /a11y-check | Skill | WCAG compliance check |
| /color-audit | Skill | Color palette + contrast |
| /typography-audit | Skill | Font inventory + consistency |
| /spacing-audit | Skill | Spacing + grid alignment |

### 6. Maestro API Knowledge Base

**Command Sequencing Rules:**
1. `maestro_list_devices` → verify connected
2. `maestro_launch_app` → app must be running
3. `maestro_capture_screen` → safe to screenshot
4. `maestro_hierarchy` → get UI tree
5. `maestro_tap` → interact
6. WAIT → let transition finish
7. `maestro_capture_screen` → capture new state

**Common Mistakes to Avoid:**
- Screenshot before app launched → black screen
- Tap then immediate screenshot → captures mid-animation
- No wait after navigation → stale hierarchy
- Hierarchy without screenshot → no visual context

**Selector Priority:**
1. accessibilityId (most reliable)
2. text (exact match)
3. text (contains/regex)
4. id (platform-specific)
5. coordinates (last resort)

**Default Waits:**
- After navigating tap: 1000-2000ms
- After app launch: 3000-5000ms
- After swipe: 500ms
- After keyboard input: 300ms

### 7. Error Handling

**Recoverable:**
- Element not found → scroll/swipe, retry
- Timeout → increase timeout, retry
- Keyboard blocking → hide keyboard, retry
- Dialog appeared → dismiss, retry

**Needs Backtrack:**
- Wrong screen → navigate back, try alt path
- App state corrupted → clear state, restart

**Fatal:**
- Device disconnected persistently
- App won't launch
- Maestro CLI not responding
→ Save partial report, exit gracefully

## Output: Quality Report

```
QUALITY INSPECTION REPORT
─────────────────────────
App: com.example.app
Screens Analyzed: 12
Components Evaluated: 147

OVERALL SCORE: 76/100
  Visual Consistency:  82/100
  Accessibility:       68/100
  Design System:       78/100

DISCOVERED DESIGN SYSTEM
  Colors: Primary #1E88E5 (23x), Secondary #FFC107 (8x)
  Typography: SF Pro Display 24px, SF Pro Text 16px
  Patterns: Card (7 screens), Bottom Nav (all)

ISSUES BY SEVERITY
  Critical (3): contrast, touch targets, labels
  Warning (8): border radius, spacing
  Info (12): minor alignment

HERMENEUTIC TRACE
  Initial: "Standard iOS design system"
  Revised: "Custom card component detected"
  Final: "Mostly consistent with 3 violations"
```

**Formats:** JSON, Markdown, HTML (with screenshots)

## Implementation Plan

### New Files to Create

1. **Agent Definition**
   - `/home/mikeb/maestro-mcp/agents/visual-inspector.md`

2. **MCP Server Extensions** (in `/home/mikeb/maestro-mcp/mcp/src/`)
   - Add tools: `maestro_capture_screen`, `maestro_focus_region`, `maestro_update_constraint`, etc.
   - Add resources: `design-system://current`, `maestro-knowledge://api-guide`

3. **Skills**
   - `/home/mikeb/maestro-mcp/skills/a11y-check/SKILL.md`
   - `/home/mikeb/maestro-mcp/skills/color-audit/SKILL.md`
   - `/home/mikeb/maestro-mcp/skills/typography-audit/SKILL.md`
   - `/home/mikeb/maestro-mcp/skills/spacing-audit/SKILL.md`

4. **Hook**
   - `/home/mikeb/maestro-mcp/hooks/visual-inspector-context.yaml`

5. **Supporting Libraries**
   - Image processing for pHash (sharp or jimp)
   - Region cropping utilities

### Implementation Order

1. Core MCP tools (capture, focus, registry)
2. Constraint resource + update tool
3. Agent definition with full system prompt
4. Audit skills (a11y, color, typography, spacing)
5. Hook for context injection
6. Report generation
7. Integration testing

## Approval

Design validated through brainstorming session on 2024-12-19.
Ready for implementation.
