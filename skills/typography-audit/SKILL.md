# Typography Audit (Font Inventory and Consistency Analysis)

Use when analyzing text rendering, identifying font families and sizes, checking typography consistency, or evaluating adherence to typographic scales.

## Purpose

Inventory and analyze all typography usage across mobile app screens to detect:
- Font families, weights, and styles in use
- Font size distribution and hierarchy
- Line height and letter spacing
- Typography consistency across screens
- Deviations from expected type scale
- Readability issues

## Hermeneutic Context

Typography is the voice of the interface. A font size or weight gains meaning through relationships:
- **Part-to-Whole:** Single text element → Screen typography → App-wide type system → Brand identity
- **Hierarchy:** Heading vs. body vs. caption → Visual importance → Information architecture
- **Consistency:** Same semantic role → Same typographic treatment → Predictable user experience

A "body text" style isn't just 16pt - it's how consistently that style appears for similar content, whether the hierarchy makes sense, and whether the type scale follows intentional ratios.

## Inputs Required

1. **Screenshot path** - Full screen capture for OCR and visual analysis
2. **UI hierarchy** - Element tree containing text elements with:
   - Text content
   - Font family (if available in hierarchy)
   - Font size (if available)
   - Font weight/style (if available)
   - Bounds (for measuring rendered size)
3. **Design system constraints** (optional) - Expected typography:
   ```json
   {
     "typography": {
       "font_family": {
         "heading": "SF Pro Display",
         "body": "SF Pro Text",
         "mono": "SF Mono"
       },
       "type_scale": {
         "h1": 32,
         "h2": 24,
         "h3": 20,
         "body": 16,
         "caption": 12
       },
       "line_height": {
         "heading": 1.2,
         "body": 1.5,
         "caption": 1.4
       }
     }
   }
   ```
4. **Previous screen typography** (optional) - For cross-screen consistency

## Analysis Process

### Step 1: Typography Extraction

**From UI Hierarchy:**
```python
def extract_text_elements(hierarchy):
    text_elements = []

    for element in traverse_hierarchy(hierarchy):
        if element.type in ["text", "label", "textview", "uilabel"]:
            text_elements.append({
                "content": element.text,
                "font_family": element.font_family or "unknown",
                "font_size": element.font_size or estimate_from_bounds(element),
                "font_weight": element.font_weight or "regular",
                "font_style": element.font_style or "normal",
                "bounds": element.bounds,
                "hierarchy_path": element.path
            })

    return text_elements
```

**Visual Analysis with Claude Vision:**

```
Analyze the typography in this mobile app screenshot.

1. FONT IDENTIFICATION:
   Identify distinct font styles used. For each style, describe:
   - Font family (if recognizable: SF Pro, Roboto, custom, etc.)
   - Approximate size in points
   - Weight (light, regular, medium, semibold, bold)
   - Style (normal, italic)
   - Where it appears

2. TYPOGRAPHIC HIERARCHY:
   Identify the typographic levels:
   - Headings (H1, H2, H3) - largest, most prominent
   - Body text - main content, comfortable reading size
   - Secondary text - labels, metadata, less prominent
   - Captions - smallest text, supplementary info

3. VISUAL ASSESSMENT:
   - Does text appear crisp and legible?
   - Is the hierarchy clear (easy to distinguish heading from body)?
   - Any text that appears too small to read comfortably?
   - Any awkward line breaks or text truncation?

4. CONSISTENCY:
   Within this screen:
   - Are similar elements using the same font style?
   - Do all body paragraphs use the same size/weight?
   - Do all headings at the same level match?

Context: [Screen name/purpose]
```

### Step 2: Font Size Clustering

Group similar font sizes to detect type scale:

```python
def cluster_font_sizes(text_elements, tolerance=2):
    """
    Group font sizes within tolerance (default ±2pt)
    to detect actual type scale in use
    """
    sizes = [e["font_size"] for e in text_elements]
    clusters = []

    for size in sorted(set(sizes)):
        # Find or create cluster
        assigned = False
        for cluster in clusters:
            if abs(cluster["median"] - size) <= tolerance:
                cluster["sizes"].append(size)
                cluster["count"] += 1
                cluster["median"] = statistics.median(cluster["sizes"])
                assigned = True
                break

        if not assigned:
            clusters.append({
                "median": size,
                "sizes": [size],
                "count": 1,
                "examples": [e for e in text_elements if e["font_size"] == size]
            })

    return sorted(clusters, key=lambda c: c["median"], reverse=True)
```

**Output:**
```json
{
  "font_size_distribution": [
    {
      "size_cluster": 32,
      "variants": [32, 31, 33],
      "count": 2,
      "role": "heading_1",
      "examples": [
        {"content": "Welcome Back", "location": "top_of_screen"},
        {"content": "Settings", "location": "settings_screen_title"}
      ]
    },
    {
      "size_cluster": 16,
      "variants": [16],
      "count": 15,
      "role": "body",
      "examples": [
        {"content": "Lorem ipsum dolor sit amet...", "location": "article_text"}
      ]
    },
    {
      "size_cluster": 14,
      "variants": [14, 13],
      "count": 8,
      "role": "secondary",
      "examples": [
        {"content": "Last updated 2 hours ago", "location": "timestamp"}
      ]
    }
  ]
}
```

### Step 3: Type Scale Analysis

Compare detected sizes against expected scale:

```python
def analyze_type_scale(clusters, expected_scale):
    """
    Check if app follows a consistent type scale
    Common scales: 1.25 (major third), 1.333 (perfect fourth), 1.5 (perfect fifth)
    """
    issues = []
    scale_ratios = []

    # Calculate ratios between adjacent sizes
    for i in range(len(clusters) - 1):
        ratio = clusters[i]["median"] / clusters[i + 1]["median"]
        scale_ratios.append(ratio)

    # Check if ratios are consistent
    avg_ratio = statistics.mean(scale_ratios)
    ratio_variance = statistics.variance(scale_ratios) if len(scale_ratios) > 1 else 0

    if ratio_variance > 0.1:
        issues.append({
            "type": "inconsistent_scale",
            "severity": "info",
            "finding": f"Type scale ratios vary: {scale_ratios}",
            "recommendation": f"Consider using consistent ratio (e.g., 1.25x or 1.333x)"
        })

    # Check against expected scale
    if expected_scale:
        for cluster in clusters:
            matching_level = None
            min_diff = float('inf')

            for level, size in expected_scale.items():
                diff = abs(cluster["median"] - size)
                if diff < min_diff:
                    min_diff = diff
                    matching_level = level

            if min_diff > 4:  # More than 4pt off from any expected size
                issues.append({
                    "type": "unexpected_size",
                    "severity": "warning",
                    "size": cluster["median"],
                    "closest_expected": matching_level,
                    "recommendation": f"Size {cluster['median']}pt doesn't match type scale. Use {expected_scale[matching_level]}pt ({matching_level})?"
                })

    return {
        "detected_scale_ratio": round(avg_ratio, 3),
        "scale_consistency": "good" if ratio_variance < 0.05 else "poor",
        "issues": issues
    }
```

### Step 4: Font Family Detection

Identify fonts in use:

```python
def analyze_font_families(text_elements):
    """
    Group by font family and detect usage patterns
    """
    families = defaultdict(lambda: {"count": 0, "sizes": [], "roles": []})

    for element in text_elements:
        family = element["font_family"]
        families[family]["count"] += 1
        families[family]["sizes"].append(element["font_size"])

        # Detect role based on size and weight
        role = detect_text_role(element)
        families[family]["roles"].append(role)

    return {
        family: {
            "count": data["count"],
            "frequency_percent": data["count"] / len(text_elements) * 100,
            "size_range": [min(data["sizes"]), max(data["sizes"])],
            "primary_role": most_common(data["roles"])
        }
        for family, data in families.items()
    }
```

**Output:**
```json
{
  "font_families": {
    "SF Pro Display": {
      "count": 8,
      "frequency_percent": 12,
      "size_range": [24, 32],
      "primary_role": "heading",
      "weights_used": ["semibold", "bold"]
    },
    "SF Pro Text": {
      "count": 52,
      "frequency_percent": 78,
      "size_range": [12, 18],
      "primary_role": "body",
      "weights_used": ["regular", "medium"]
    },
    "System Font": {
      "count": 7,
      "frequency_percent": 10,
      "size_range": [14, 16],
      "primary_role": "secondary",
      "weights_used": ["regular"],
      "note": "May indicate missing font family specification"
    }
  }
}
```

### Step 5: Typography Consistency Check

Compare across screens:

```python
def check_consistency(current_screen, previous_screens):
    """
    Compare typography usage for same semantic roles
    """
    issues = []

    # Build role → style mapping from previous screens
    role_styles = defaultdict(list)
    for screen in previous_screens:
        for element in screen.text_elements:
            role = detect_text_role(element)
            role_styles[role].append({
                "family": element["font_family"],
                "size": element["font_size"],
                "weight": element["font_weight"],
                "screen": screen.id
            })

    # Check current screen against patterns
    for element in current_screen.text_elements:
        role = detect_text_role(element)

        if role not in role_styles:
            continue  # New role, can't compare

        # Get most common style for this role
        expected_styles = role_styles[role]
        most_common_style = mode([
            (s["family"], s["size"], s["weight"]) for s in expected_styles
        ])

        current_style = (
            element["font_family"],
            element["font_size"],
            element["font_weight"]
        )

        if current_style != most_common_style:
            issues.append({
                "type": "inconsistent_typography",
                "role": role,
                "element": element["content"][:50],
                "current": {
                    "family": current_style[0],
                    "size": current_style[1],
                    "weight": current_style[2]
                },
                "expected": {
                    "family": most_common_style[0],
                    "size": most_common_style[1],
                    "weight": most_common_style[2]
                },
                "precedent_screens": list(set(s["screen"] for s in expected_styles)),
                "severity": "warning"
            })

    return issues
```

### Step 6: Readability Analysis

Check for readability issues:

```python
def analyze_readability(text_elements, screenshot):
    issues = []

    for element in text_elements:
        # Font size too small
        if element["font_size"] < 12:
            issues.append({
                "type": "text_too_small",
                "element": element["content"][:50],
                "size": element["font_size"],
                "severity": "critical" if element["role"] == "body" else "warning",
                "recommendation": "Minimum 12pt for any text, 16pt for body"
            })

        # Line length too long
        if element["role"] == "body":
            chars_per_line = estimate_chars_per_line(element, screenshot)
            if chars_per_line > 75:
                issues.append({
                    "type": "line_too_long",
                    "element": element["content"][:50],
                    "chars_per_line": chars_per_line,
                    "severity": "info",
                    "recommendation": "Optimal line length: 50-75 characters"
                })

        # All caps for long text
        if element["content"].isupper() and len(element["content"]) > 20:
            issues.append({
                "type": "excessive_caps",
                "element": element["content"][:50],
                "severity": "warning",
                "recommendation": "Avoid all-caps for body text (reduces readability)"
            })

    return issues
```

## Output Format

```json
{
  "screen_id": "screen_001",
  "screen_name": "Article View",
  "timestamp": "2024-12-19T10:30:00Z",
  "typography_summary": {
    "total_text_elements": 23,
    "unique_font_families": 2,
    "unique_sizes": 5,
    "type_scale_ratio": 1.33,
    "scale_consistency": "good"
  },
  "font_families": {
    "SF Pro Display": {
      "usage_count": 3,
      "frequency_percent": 13,
      "roles": ["heading"],
      "sizes": [24, 32],
      "weights": ["semibold"]
    },
    "SF Pro Text": {
      "usage_count": 20,
      "frequency_percent": 87,
      "roles": ["body", "secondary", "caption"],
      "sizes": [12, 14, 16, 18],
      "weights": ["regular", "medium"]
    }
  },
  "type_scale": {
    "levels": [
      {
        "level": "h1",
        "size_cluster": 32,
        "count": 1,
        "examples": ["Article Title"],
        "matches_expected": true,
        "expected_size": 32
      },
      {
        "level": "h2",
        "size_cluster": 24,
        "count": 2,
        "examples": ["Section Heading", "Related Articles"],
        "matches_expected": true,
        "expected_size": 24
      },
      {
        "level": "body",
        "size_cluster": 16,
        "count": 15,
        "examples": ["Article body text..."],
        "matches_expected": true,
        "expected_size": 16
      },
      {
        "level": "secondary",
        "size_cluster": 14,
        "count": 4,
        "examples": ["Author name", "Published date"],
        "matches_expected": false,
        "expected_size": null,
        "note": "No expected size defined, but commonly used"
      },
      {
        "level": "caption",
        "size_cluster": 12,
        "count": 1,
        "examples": ["Image caption"],
        "matches_expected": true,
        "expected_size": 12
      }
    ],
    "scale_ratio": 1.33,
    "follows_scale": true
  },
  "consistency_issues": [
    {
      "type": "inconsistent_typography",
      "severity": "warning",
      "element": "Author name",
      "role": "secondary",
      "current": {
        "family": "SF Pro Text",
        "size": 14,
        "weight": "regular"
      },
      "expected": {
        "family": "SF Pro Text",
        "size": 13,
        "weight": "medium"
      },
      "precedent_screens": ["screen_000", "screen_002"],
      "recommendation": "Use 13pt medium (consistent with Home and Profile screens)"
    }
  ],
  "readability_issues": [
    {
      "type": "line_too_long",
      "severity": "info",
      "element": "Article body paragraph...",
      "chars_per_line": 85,
      "recommendation": "Reduce line length to 50-75 characters for optimal readability"
    }
  ],
  "accessibility_notes": [
    {
      "type": "small_text",
      "severity": "warning",
      "element": "Legal disclaimer",
      "size": 10,
      "recommendation": "Increase to minimum 12pt"
    }
  ],
  "hermeneutic_notes": [
    "SF Pro Display used consistently for headings across all screens - strong pattern",
    "Body text consistently 16pt - follows iOS best practices",
    "Type scale follows 1.33x (perfect fourth) ratio - intentional and consistent",
    "Secondary text varies (13pt vs 14pt) across screens - minor inconsistency",
    "No custom fonts detected - uses system fonts appropriately"
  ]
}
```

## Visual Analysis Prompts

**Font Identification:**
```
Look at this screenshot and identify all distinct text styles you can see.

For each style, describe:
1. Approximate font size (tiny/small/medium/large/xlarge)
2. Font weight (thin/light/regular/medium/semibold/bold/heavy)
3. What type of content uses this style (heading, body, label, etc.)
4. Color of the text
5. Whether it looks like a system font or custom font

List from largest to smallest.
```

**Hierarchy Assessment:**
```
Evaluate the typographic hierarchy in this screenshot:

1. Is it clear which text is most important? (Should be largest/boldest)
2. Are there distinct levels of importance? (e.g., title > subheading > body)
3. Does the size difference between levels feel appropriate?
4. Any text that blends in when it should stand out (or vice versa)?
5. Overall: Does the typography guide your eye through the content in a logical order?

Rate the hierarchy: Excellent / Good / Needs Improvement / Poor
```

## Integration with Visual Inspector

```yaml
# Visual Inspector workflow
- capture_screen: screen_001
- run_skill: /typography-audit
  inputs:
    screenshot: screen_001.png
    hierarchy: screen_001_hierarchy.json
    design_system: design_system.typography
    previous_screens: [screen_000]

# Update design system with discovered patterns
- if: typography_audit.type_scale.follows_scale == true
  then:
    - update_constraint:
        path: "discovered_patterns.typography.scale_ratio"
        value: typography_audit.type_scale.scale_ratio
        evidence: screen_001

# Track consistency across screens
- accumulate:
    target: typography_consistency_tracker
    data: typography_audit.consistency_issues
```

## Best Practices

### Do:
- Analyze typography in context of information hierarchy
- Compare semantic roles across screens (all H1s should match)
- Measure consistency with tolerance (±2pt is acceptable variance)
- Consider platform conventions (iOS vs Android default sizes)
- Provide specific size/weight recommendations

### Don't:
- Report minor variations (1-2pt) as critical issues
- Ignore context (caption text can be smaller than body)
- Assume all text of same size should have same role
- Overlook system font fallbacks (may indicate missing font)

## Typography Metrics

**Type Scale Ratios:**
- 1.125 (major second) - subtle
- 1.200 (minor third) - moderate
- 1.250 (major third) - balanced
- 1.333 (perfect fourth) - strong
- 1.414 (augmented fourth) - dramatic
- 1.500 (perfect fifth) - very dramatic

**Readability Guidelines:**
- Body text: 16-18pt mobile, 14-16pt desktop
- Line height: 1.4-1.6x font size for body text
- Line length: 50-75 characters optimal
- Paragraph spacing: 1.5-2x line height

**Platform Defaults:**
- iOS: SF Pro Text (body), SF Pro Display (headings), 17pt default
- Android: Roboto (all), 16sp default
- Minimum: 11pt (iOS), 12sp (Android)

## Reference

**Standards:**
- Apple HIG: Typography
- Material Design: Type system
- WCAG 1.4.4: Text resize
- WCAG 1.4.12: Text spacing

Apply this skill to build comprehensive typography profile and detect systemic vs. isolated typography issues.
