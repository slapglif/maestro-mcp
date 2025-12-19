# Accessibility Audit (WCAG Compliance Check)

Use when evaluating mobile app accessibility compliance, checking WCAG guidelines, or identifying accessibility barriers in UI screenshots and hierarchies.

## Purpose

Systematically evaluate mobile UI against WCAG 2.1 Level AA standards to identify accessibility violations. Focuses on visual analysis using Claude Vision combined with UI hierarchy data from Maestro to detect contrast issues, insufficient touch targets, missing labels, and readability problems.

## Hermeneutic Context

Accessibility is not isolated metrics - a component is accessible only in relation to the whole user experience. A button's touch target size matters relative to surrounding elements. Color contrast matters relative to the entire visual hierarchy. Text size matters relative to content importance and reading flow.

**Part-to-Whole Analysis:**
- Individual element (button, label, input) → Screen context
- Screen accessibility → App-wide accessibility patterns
- Single violation → Systemic accessibility strategy

## Inputs Required

1. **Screenshot path** - Full screen capture for visual analysis
2. **UI hierarchy** - Element tree from `maestro_hierarchy` containing:
   - Element bounds (x, y, width, height)
   - Element text content
   - Accessibility labels/identifiers
   - Element types (button, text, image, etc.)
3. **Design system constraints** (optional) - Expected minimum values:
   - `min_contrast`: 4.5 (WCAG AA for normal text)
   - `min_touch_target`: 44 (Apple HIG minimum)
   - `require_labels`: true
4. **Context from previous screens** (optional) - Known accessibility patterns

## Evaluation Criteria

### 1. Color Contrast (WCAG 1.4.3)

**Standards:**
- Normal text: 4.5:1 minimum
- Large text (18pt+ or 14pt+ bold): 3:1 minimum
- UI components and graphics: 3:1 minimum

**Process:**
1. Extract text regions from screenshot
2. For each text element in hierarchy:
   - Sample foreground color (text)
   - Sample background color (behind text)
   - Calculate contrast ratio: (L1 + 0.05) / (L2 + 0.05)
   - Where L = relative luminance
3. Flag violations with actual ratio

**Output:**
```json
{
  "element": "Login button",
  "text_color": "#D3D3D3",
  "bg_color": "#FFFFFF",
  "contrast_ratio": 1.8,
  "required": 4.5,
  "severity": "critical",
  "wcag": "1.4.3"
}
```

### 2. Touch Target Size (WCAG 2.5.5)

**Standards:**
- Minimum: 44x44 points (iOS HIG, WCAG Level AAA)
- Acceptable: 24x24 points (WCAG Level AA 2.5.8)
- Best practice: 48x48 density-independent pixels (Material Design)

**Process:**
1. Identify interactive elements in hierarchy (buttons, links, inputs, toggles)
2. Extract bounds for each element
3. Calculate physical size in points (accounting for screen density if available)
4. Check spacing between adjacent touch targets (minimum 8pt recommended)

**Output:**
```json
{
  "element": "Close icon",
  "bounds": {"width": 24, "height": 24},
  "size_points": 24,
  "required": 44,
  "severity": "critical",
  "wcag": "2.5.5",
  "recommendation": "Increase tap area to 44x44pt, or add padding"
}
```

### 3. Text Labels (WCAG 1.1.1, 2.4.6, 4.1.2)

**Requirements:**
- All interactive elements must have accessible labels
- Images must have alt text (or be marked decorative)
- Form inputs must have associated labels
- Icons must have text alternatives

**Process:**
1. For each interactive element:
   - Check for accessibility label/identifier
   - Check for visible text content
   - Check for content description (Android) or accessibilityLabel (iOS)
2. For images: verify alt text or decorative flag
3. For icon-only buttons: verify label present

**Output:**
```json
{
  "element": "Icon button at (320, 64)",
  "type": "button",
  "has_visual_label": false,
  "has_accessibility_label": false,
  "severity": "critical",
  "wcag": "4.1.2",
  "recommendation": "Add accessibilityLabel describing button action"
}
```

### 4. Text Size and Readability (WCAG 1.4.4, 1.4.12)

**Standards:**
- Body text: 16pt minimum (iOS), 16sp minimum (Android)
- Small text acceptable for captions: 12pt minimum
- Text must support 200% zoom without horizontal scrolling
- Line height: 1.5x font size minimum
- Paragraph spacing: 2x font size minimum

**Process:**
1. Extract font sizes from hierarchy metadata
2. Identify body text vs. UI labels vs. captions
3. Check against minimum sizes
4. Verify text is not embedded in images (unless decorative)

**Output:**
```json
{
  "element": "Description text",
  "font_size": 11,
  "text_type": "body",
  "required_min": 16,
  "severity": "warning",
  "wcag": "1.4.12",
  "recommendation": "Increase body text to 16pt"
}
```

### 5. Focus Indicators (WCAG 2.4.7)

**Requirements:**
- Keyboard/voice control users must see which element has focus
- Focus indicator must have 3:1 contrast with adjacent colors
- Focus must follow logical order

**Process:**
1. Identify if focus indicators are visible in screenshot
2. Check contrast of focus rings/highlights
3. Verify tab order matches visual layout (using hierarchy)

**Output:**
```json
{
  "element": "Email input field",
  "has_focus_indicator": true,
  "focus_contrast": 2.1,
  "required": 3.0,
  "severity": "warning",
  "wcag": "2.4.7"
}
```

### 6. Motion and Animation (WCAG 2.3.3)

**Requirements:**
- No flashing content (more than 3 flashes per second)
- Motion can be disabled
- Animations respect reduced motion preferences

**Process:**
1. Detect animation elements in hierarchy
2. Check for motion control toggles
3. If comparing multiple screenshots, detect rapid changes

**Output:**
```json
{
  "screen": "Dashboard",
  "has_animations": true,
  "respects_reduce_motion": "unknown",
  "severity": "info",
  "wcag": "2.3.3",
  "recommendation": "Verify app respects prefers-reduced-motion"
}
```

## Analysis Protocol

### Step 1: Visual Inspection with Claude Vision

Use Claude's multimodal capability to analyze the screenshot:

**Prompt template:**
```
Analyze this mobile app screenshot for accessibility issues. Identify:

1. Text that appears low contrast or hard to read
2. Interactive elements (buttons, links) that appear too small
3. Icon-only buttons without visible labels
4. Text that appears too small for body content
5. Any visual indicators of focus states

For each issue, describe:
- Element location and appearance
- Why it may be problematic
- Suggested fix

Context: This screen is [describe screen purpose from hierarchy].
```

### Step 2: Hierarchy Analysis

Parse the UI hierarchy JSON to extract quantitative data:

```python
def analyze_hierarchy(hierarchy, screenshot_path):
    violations = []

    for element in traverse_hierarchy(hierarchy):
        # Touch target size
        if element.is_interactive():
            width, height = element.bounds.size
            if width < 44 or height < 44:
                violations.append({
                    "type": "touch_target",
                    "element": element.describe(),
                    "size": (width, height),
                    "severity": "critical" if min(width, height) < 24 else "warning"
                })

        # Missing labels
        if element.is_interactive() and not element.has_label():
            violations.append({
                "type": "missing_label",
                "element": element.describe(),
                "severity": "critical"
            })

        # Text size
        if element.is_text() and element.font_size:
            min_size = 16 if element.is_body_text() else 12
            if element.font_size < min_size:
                violations.append({
                    "type": "text_size",
                    "element": element.describe(),
                    "size": element.font_size,
                    "severity": "warning"
                })

    return violations
```

### Step 3: Color Contrast Calculation

Use screenshot to sample colors and compute ratios:

```python
def check_contrast(screenshot_path, text_bounds):
    img = load_image(screenshot_path)

    # Sample text color (center of bounds)
    text_color = sample_color(img, text_bounds.center())

    # Sample background (corners of bounds, exclude text pixels)
    bg_color = sample_background(img, text_bounds)

    # Calculate relative luminance
    L1 = relative_luminance(text_color)
    L2 = relative_luminance(bg_color)

    # Contrast ratio
    ratio = (max(L1, L2) + 0.05) / (min(L1, L2) + 0.05)

    return {
        "text_color": text_color,
        "bg_color": bg_color,
        "contrast": round(ratio, 2),
        "passes_aa": ratio >= 4.5,
        "passes_aaa": ratio >= 7.0
    }
```

### Step 4: Contextual Interpretation

Relate findings to app-wide patterns:

- **First violation of type:** May indicate systemic issue
- **Isolated violation:** May be edge case or oversight
- **Pattern across screens:** Confirm as design system issue

**Questions to ask:**
- "Have we seen this button style before? Was it accessible then?"
- "Is this text size used for body content elsewhere?"
- "Does this contrast issue appear across all screens?"

### Step 5: Severity Classification

| Severity | Criteria | Examples |
|----------|----------|----------|
| **Critical** | Blocks access for users with disabilities | Touch target < 24pt, missing label on primary action, contrast < 3:1 |
| **Warning** | Significantly impairs access | Touch target < 44pt, contrast 3:1-4.4:1, text size < 16pt |
| **Info** | Minor improvement opportunity | Contrast 4.5:1-7:0:1 (passes AA not AAA), 44pt but no spacing |

## Output Format

Return structured JSON report:

```json
{
  "screen_id": "screen_001",
  "screen_name": "Login Screen",
  "timestamp": "2024-12-19T10:30:00Z",
  "wcag_score": 72,
  "violations": [
    {
      "id": "a11y_001",
      "type": "contrast",
      "severity": "critical",
      "wcag_criterion": "1.4.3",
      "element": {
        "description": "Login button text",
        "bounds": {"x": 120, "y": 400, "width": 180, "height": 48},
        "hierarchy_path": "Screen > Container > Button[0] > Text"
      },
      "finding": {
        "text_color": "#D3D3D3",
        "bg_color": "#FFFFFF",
        "contrast_ratio": 1.8,
        "required": 4.5
      },
      "recommendation": "Increase text color darkness to #767676 (contrast 4.5:1) or use primary brand color"
    },
    {
      "id": "a11y_002",
      "type": "touch_target",
      "severity": "warning",
      "wcag_criterion": "2.5.5",
      "element": {
        "description": "Password visibility toggle icon",
        "bounds": {"x": 300, "y": 250, "width": 32, "height": 32}
      },
      "finding": {
        "width": 32,
        "height": 32,
        "required": 44
      },
      "recommendation": "Increase tap area to 44x44pt by adding transparent padding around icon"
    }
  ],
  "passed_checks": [
    {
      "type": "labels",
      "count": 8,
      "message": "All interactive elements have accessibility labels"
    }
  ],
  "hermeneutic_notes": [
    "This login screen follows common patterns seen on previous screens (Home, Settings)",
    "Touch target issue is isolated to this screen - other screens use 48pt buttons",
    "Contrast issue may be systemic - verify this gray is not part of design system"
  ]
}
```

## Integration with Visual Inspector

The Visual Inspector agent calls this skill for each screen:

```yaml
# Visual Inspector loop
- capture_screen: screen_001
- run_skill: /a11y-check
  inputs:
    screenshot: screen_001.png
    hierarchy: screen_001_hierarchy.json
    constraints: design_system.accessibility
- record_findings: accessibility
- update_hypotheses:
    - "Touch target violations isolated to icon buttons"
    - "Body text consistently uses 14pt (below 16pt standard)"
```

## Best Practices

### Do:
- Analyze parts (elements) in relation to whole (screen, app)
- Compare findings across screens to detect patterns
- Provide actionable recommendations with specific values
- Note when violations may be intentional design choices
- Reference WCAG criteria by number

### Don't:
- Evaluate in isolation without screen context
- Report false positives (e.g., decorative images as missing alt text)
- Assume user intent - flag for review when unclear
- Use vague language like "possibly too small" - measure precisely

## Reference

**WCAG 2.1 Level AA Criteria:**
- 1.1.1 Non-text Content
- 1.4.3 Contrast (Minimum)
- 1.4.4 Resize Text
- 1.4.12 Text Spacing
- 2.4.6 Headings and Labels
- 2.4.7 Focus Visible
- 2.5.5 Target Size
- 4.1.2 Name, Role, Value

**Platform Guidelines:**
- Apple HIG: Human Interface Guidelines - Accessibility
- Material Design: Accessibility principles
- WCAG: Web Content Accessibility Guidelines 2.1

**Tools for verification:**
- Contrast calculation: (max(L1,L2) + 0.05) / (min(L1,L2) + 0.05)
- Relative luminance: L = 0.2126*R + 0.7152*G + 0.0722*B (where R,G,B are linearized)

Apply this skill systematically across all screens to build comprehensive accessibility profile of the application.
