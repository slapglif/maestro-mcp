# Spacing Audit (Grid Alignment and Spacing Consistency)

Use when analyzing layout spacing, measuring margins and padding, checking grid alignment, or identifying spacing inconsistencies across UI elements.

## Purpose

Measure and analyze spacing between UI elements to detect:
- Spacing values in use (margins, padding, gaps)
- Grid alignment and adherence to layout system
- Inconsistent spacing for similar element relationships
- Deviation from expected spacing scale
- Visual rhythm and vertical/horizontal alignment issues

## Hermeneutic Context

Spacing creates relationships. The distance between elements communicates their semantic connection:
- **Part-to-Whole:** Element spacing → Screen layout → App-wide grid system → Design coherence
- **Relationships:** Tight spacing = related elements, loose spacing = separate sections
- **Rhythm:** Consistent spacing creates visual rhythm and predictability

A "16px margin" isn't just a number - it's whether that value appears consistently for similar relationships, whether it follows a scale, and whether it reinforces the visual hierarchy.

## Inputs Required

1. **Screenshot path** - Full screen capture for visual measurement
2. **UI hierarchy** - Element tree with bounding boxes:
   - Each element: `{x, y, width, height}`
   - Parent-child relationships
   - Element types
3. **Design system constraints** (optional) - Expected spacing:
   ```json
   {
     "spacing": {
       "unit": 8,
       "scale": [4, 8, 12, 16, 24, 32, 48, 64],
       "grid_columns": 12,
       "gutter": 16,
       "margin": 16
     }
   }
   ```
4. **Previous screen spacing** (optional) - For cross-screen consistency

## Analysis Process

### Step 1: Spacing Extraction

**Measure spacing between adjacent elements:**

```python
def extract_spacing(hierarchy):
    """
    Measure spacing between all adjacent elements
    """
    spacings = []
    elements = list(traverse_hierarchy(hierarchy))

    for i, elem1 in enumerate(elements):
        for elem2 in elements[i+1:]:
            # Skip if not visually related
            if not are_adjacent(elem1, elem2):
                continue

            spacing = measure_spacing(elem1, elem2)
            if spacing:
                spacings.append({
                    "value": spacing["distance"],
                    "direction": spacing["direction"],  # "vertical", "horizontal"
                    "relationship": detect_relationship(elem1, elem2),
                    "elements": [elem1.id, elem2.id],
                    "context": spacing["context"]  # "sibling", "parent-child", "unrelated"
                })

    return spacings

def measure_spacing(elem1, elem2):
    """
    Calculate spacing between two elements
    """
    # Vertical spacing
    if elem1.bottom <= elem2.top:
        return {
            "distance": elem2.top - elem1.bottom,
            "direction": "vertical",
            "context": "vertical_stack"
        }

    # Horizontal spacing
    if elem1.right <= elem2.left:
        return {
            "distance": elem2.left - elem1.right,
            "direction": "horizontal",
            "context": "horizontal_row"
        }

    # Overlapping or not adjacent
    return None
```

### Step 2: Spacing Clustering

Group similar spacing values to detect scale:

```python
def cluster_spacing(spacings, tolerance=4):
    """
    Group spacing values within tolerance to detect spacing scale
    tolerance: acceptable variance (default ±4px for 8px grid)
    """
    clusters = []

    for spacing in sorted(spacings, key=lambda s: s["value"]):
        value = spacing["value"]

        # Find matching cluster
        assigned = False
        for cluster in clusters:
            if abs(cluster["median"] - value) <= tolerance:
                cluster["values"].append(value)
                cluster["count"] += 1
                cluster["median"] = statistics.median(cluster["values"])
                cluster["examples"].append(spacing)
                assigned = True
                break

        if not assigned:
            clusters.append({
                "median": value,
                "values": [value],
                "count": 1,
                "examples": [spacing]
            })

    # Sort by frequency
    return sorted(clusters, key=lambda c: c["count"], reverse=True)
```

**Output:**
```json
{
  "spacing_distribution": [
    {
      "value_cluster": 16,
      "variants": [14, 16, 17, 18],
      "count": 45,
      "usage_percent": 38,
      "contexts": {
        "vertical_stack": 30,
        "horizontal_row": 10,
        "parent_child": 5
      },
      "examples": [
        {
          "between": ["Button", "Text label"],
          "direction": "vertical",
          "exact_value": 16
        }
      ]
    },
    {
      "value_cluster": 8,
      "variants": [7, 8, 9],
      "count": 28,
      "usage_percent": 24,
      "contexts": {
        "horizontal_row": 20,
        "vertical_stack": 8
      }
    }
  ]
}
```

### Step 3: Grid Alignment Analysis

Check if elements align to a grid:

```python
def analyze_grid_alignment(elements, grid_unit=8):
    """
    Check if element positions align to a grid
    """
    issues = []
    alignment_score = 0
    total_checks = 0

    for element in elements:
        # Check x position
        if element.x % grid_unit != 0:
            offset = element.x % grid_unit
            issues.append({
                "type": "horizontal_misalignment",
                "element": element.id,
                "position": element.x,
                "offset": offset,
                "nearest_grid": round(element.x / grid_unit) * grid_unit,
                "severity": "warning" if offset > 2 else "info"
            })
        else:
            alignment_score += 1

        total_checks += 1

        # Check y position
        if element.y % grid_unit != 0:
            offset = element.y % grid_unit
            issues.append({
                "type": "vertical_misalignment",
                "element": element.id,
                "position": element.y,
                "offset": offset,
                "nearest_grid": round(element.y / grid_unit) * grid_unit,
                "severity": "warning" if offset > 2 else "info"
            })
        else:
            alignment_score += 1

        total_checks += 1

    return {
        "grid_unit": grid_unit,
        "alignment_score": (alignment_score / total_checks) * 100,
        "misalignments": len(issues),
        "issues": issues
    }
```

### Step 4: Spacing Scale Analysis

Compare detected spacing against expected scale:

```python
def analyze_spacing_scale(clusters, expected_scale):
    """
    Check if spacing follows a consistent scale (e.g., 4, 8, 16, 24, 32...)
    """
    issues = []

    # Check if scale is geometric (e.g., 8, 16, 32) or arithmetic (e.g., 8, 16, 24)
    detected_values = [c["median"] for c in clusters]

    # Try to detect base unit (GCD of all values)
    base_unit = reduce(gcd, detected_values)

    # Check if values are multiples of base unit
    for cluster in clusters:
        value = cluster["median"]
        closest_expected = min(expected_scale, key=lambda x: abs(x - value))
        diff = abs(value - closest_expected)

        if diff > 4:  # More than 4px off
            issues.append({
                "type": "off_scale",
                "value": value,
                "frequency": cluster["count"],
                "closest_expected": closest_expected,
                "difference": diff,
                "severity": "warning",
                "recommendation": f"Use {closest_expected}px (from spacing scale)"
            })

    # Check for missing scale values
    for expected in expected_scale:
        if not any(abs(c["median"] - expected) <= 4 for c in clusters):
            # Only report if we'd expect to see this value (not too large/small)
            if 8 <= expected <= 48:
                issues.append({
                    "type": "missing_scale_value",
                    "value": expected,
                    "severity": "info",
                    "note": f"Expected spacing value {expected}px not found (may not be needed)"
                })

    return {
        "detected_base_unit": base_unit,
        "follows_scale": len(issues) < len(clusters) * 0.3,  # <30% off-scale is acceptable
        "scale_adherence_score": (1 - len([i for i in issues if i["type"] == "off_scale"]) / len(clusters)) * 100,
        "issues": issues
    }
```

### Step 5: Visual Rhythm Analysis

Check consistency of spacing for similar relationships:

```python
def analyze_visual_rhythm(spacings):
    """
    Check if similar element relationships use consistent spacing
    """
    # Group by relationship type
    by_relationship = defaultdict(list)
    for spacing in spacings:
        key = (spacing["relationship"], spacing["direction"])
        by_relationship[key].append(spacing["value"])

    issues = []

    for (relationship, direction), values in by_relationship.items():
        if len(values) < 2:
            continue  # Need multiple instances to check consistency

        # Calculate variance
        mean_spacing = statistics.mean(values)
        variance = statistics.variance(values)
        std_dev = statistics.stdev(values)

        # High variance indicates inconsistency
        if std_dev > 4:  # More than 4px standard deviation
            issues.append({
                "type": "inconsistent_rhythm",
                "relationship": relationship,
                "direction": direction,
                "values": sorted(set(values)),
                "mean": round(mean_spacing, 1),
                "std_dev": round(std_dev, 1),
                "severity": "warning",
                "recommendation": f"Standardize {relationship} spacing to {round(mean_spacing / 8) * 8}px"
            })

    return issues
```

### Step 6: Optical Alignment Check

Use visual analysis to detect optical misalignment:

```python
def check_optical_alignment(screenshot, elements):
    """
    Detect elements that should visually align but don't
    (e.g., left-aligned text not at same x position)
    """
    issues = []

    # Group elements by approximate vertical position (rows)
    rows = group_into_rows(elements, tolerance=20)

    for row in rows:
        # Check horizontal alignment within row
        left_edges = [e.x for e in row if e.alignment == "left"]
        right_edges = [e.x + e.width for e in row if e.alignment == "right"]

        # If multiple left-aligned elements, they should align
        if len(left_edges) > 1:
            unique_edges = set(left_edges)
            if len(unique_edges) > 1:
                most_common_edge = mode(left_edges)
                for element in row:
                    if element.x != most_common_edge and abs(element.x - most_common_edge) > 2:
                        issues.append({
                            "type": "horizontal_misalignment",
                            "element": element.id,
                            "position": element.x,
                            "expected": most_common_edge,
                            "offset": element.x - most_common_edge,
                            "severity": "warning"
                        })

    return issues
```

## Visual Analysis with Claude Vision

**Spacing Assessment Prompt:**

```
Analyze the spacing and alignment in this mobile app screenshot.

1. SPACING EVALUATION:
   - Does spacing between elements feel consistent?
   - Any areas where elements feel cramped or too spread out?
   - Are there clear visual groupings (tight spacing within groups, loose spacing between groups)?

2. ALIGNMENT ASSESSMENT:
   - Do elements line up properly (left-aligned text, centered elements)?
   - Any elements that look slightly off-center or misaligned?
   - Do columns/rows form clean visual lines?

3. VISUAL RHYTHM:
   - Does the layout have a pleasing rhythm (consistent patterns)?
   - Any awkward breaks in rhythm or irregular spacing?

4. WHITE SPACE:
   - Is there enough breathing room around elements?
   - Any areas that feel cluttered?
   - Is white space used intentionally to guide attention?

5. GRID SYSTEM:
   - Does the layout appear to follow a grid?
   - Any elements that break the grid in a jarring way?

Rate overall spacing: Excellent / Good / Needs Improvement / Poor
```

**Specific Measurement Prompt:**

```
Look at this screenshot and estimate the spacing (in pixels) between these element pairs:

1. Screen edge to first content
2. Between heading and body text below it
3. Between list items (if present)
4. Between button and surrounding elements
5. Left/right margins from screen edge

Provide approximate values (e.g., "about 16px", "roughly 8-12px", "very tight, maybe 4px").
```

## Output Format

```json
{
  "screen_id": "screen_001",
  "screen_name": "Product List",
  "timestamp": "2024-12-19T10:30:00Z",
  "spacing_summary": {
    "detected_base_unit": 8,
    "follows_spacing_scale": true,
    "scale_adherence_score": 87,
    "grid_alignment_score": 92,
    "visual_rhythm_score": 78
  },
  "spacing_inventory": [
    {
      "value_cluster": 16,
      "frequency": 45,
      "percentage": 38,
      "matches_scale": true,
      "expected_value": 16,
      "primary_uses": [
        "Vertical spacing between cards",
        "Horizontal margin from screen edge",
        "Padding inside buttons"
      ]
    },
    {
      "value_cluster": 8,
      "frequency": 28,
      "percentage": 24,
      "matches_scale": true,
      "expected_value": 8,
      "primary_uses": [
        "Spacing between icon and label",
        "Padding inside cards",
        "Gap between list items"
      ]
    },
    {
      "value_cluster": 18,
      "frequency": 12,
      "percentage": 10,
      "matches_scale": false,
      "expected_value": 16,
      "deviation": 2,
      "primary_uses": [
        "Spacing between product title and price"
      ],
      "note": "Close to 16px - possible inconsistency"
    }
  ],
  "grid_alignment": {
    "grid_unit": 8,
    "elements_checked": 42,
    "aligned_elements": 39,
    "alignment_score": 92.9,
    "misalignments": [
      {
        "element": "Search icon",
        "position": {"x": 14, "y": 32},
        "nearest_grid": {"x": 16, "y": 32},
        "offset": {"x": -2, "y": 0},
        "severity": "info"
      }
    ]
  },
  "consistency_issues": [
    {
      "type": "inconsistent_rhythm",
      "severity": "warning",
      "relationship": "card_vertical_spacing",
      "values_found": [14, 16, 18, 20],
      "mean": 17,
      "std_dev": 2.4,
      "occurrences": 12,
      "recommendation": "Standardize card spacing to 16px"
    },
    {
      "type": "off_scale",
      "severity": "warning",
      "value": 18,
      "frequency": 12,
      "closest_expected": 16,
      "difference": 2,
      "recommendation": "Use 16px (from spacing scale) instead of 18px"
    }
  ],
  "optical_alignment_issues": [
    {
      "type": "horizontal_misalignment",
      "severity": "warning",
      "description": "Product titles not consistently left-aligned",
      "elements": ["Product 1 title", "Product 3 title"],
      "positions": [24, 28],
      "expected": 24,
      "recommendation": "Align all product titles to x=24"
    }
  ],
  "scale_analysis": {
    "detected_scale": [4, 8, 12, 16, 24, 32],
    "expected_scale": [4, 8, 12, 16, 24, 32, 48, 64],
    "missing_values": [48, 64],
    "unexpected_values": [18, 20],
    "base_unit": 8,
    "follows_systematic_scale": true
  },
  "visual_assessment": {
    "overall_rating": "Good",
    "strengths": [
      "Consistent use of 16px margins",
      "Clear visual grouping with spacing",
      "Good use of white space around primary actions"
    ],
    "weaknesses": [
      "Minor inconsistencies in card spacing (14-20px range)",
      "Some elements slightly off-grid (1-2px)"
    ]
  },
  "hermeneutic_notes": [
    "8px base unit used consistently across all screens - strong pattern",
    "16px is dominant spacing value (38% of all spacing) - likely the primary unit",
    "Card spacing varies slightly (14-20px) - may be intentional for different card types, or inconsistency",
    "Grid alignment generally strong (93%) - minor 1-2px offsets may be rendering artifacts",
    "No spacing values outside the scale detected - good adherence to design system"
  ]
}
```

## Integration with Visual Inspector

```yaml
# Visual Inspector workflow
- capture_screen: screen_001
- run_skill: /spacing-audit
  inputs:
    screenshot: screen_001.png
    hierarchy: screen_001_hierarchy.json
    design_system: design_system.spacing
    previous_screens: [screen_000]

# Update design system with discovered patterns
- if: spacing_audit.spacing_summary.follows_spacing_scale == true
  then:
    - update_constraint:
        path: "discovered_patterns.spacing.base_unit"
        value: spacing_audit.spacing_summary.detected_base_unit
        evidence: screen_001
    - update_constraint:
        path: "discovered_patterns.spacing.scale"
        value: spacing_audit.scale_analysis.detected_scale
        evidence: screen_001

# Track consistency across screens
- accumulate:
    target: spacing_consistency_tracker
    data: spacing_audit.consistency_issues
```

## Best Practices

### Do:
- Measure spacing in context of relationships (sibling spacing vs. section spacing)
- Allow for small variances (±2px) due to rendering or sub-pixel positioning
- Compare similar relationships across screens (all card spacing should match)
- Consider optical alignment vs. mathematical alignment
- Provide specific pixel values in recommendations

### Don't:
- Report sub-pixel differences (<2px) as critical issues
- Ignore context (tight spacing may be intentional for related items)
- Assume all spacing should be identical (hierarchy requires variation)
- Overlook negative space (absence of spacing is also meaningful)

## Spacing Measurement Techniques

**Adjacent Element Spacing:**
```python
# Vertical spacing
vertical_gap = element2.top - element1.bottom

# Horizontal spacing
horizontal_gap = element2.left - element1.right
```

**Padding (Element to Content):**
```python
# Top padding
top_padding = first_child.top - parent.top

# Left padding
left_padding = first_child.left - parent.left
```

**Margins (Element to Container Edge):**
```python
# Left margin
left_margin = element.left - container.left

# Top margin
top_margin = element.top - container.top
```

**Grid Alignment Check:**
```python
def is_on_grid(position, grid_unit, tolerance=2):
    offset = position % grid_unit
    return offset <= tolerance or offset >= (grid_unit - tolerance)
```

## Common Spacing Scales

**Linear (8pt grid):**
- 4, 8, 12, 16, 24, 32, 48, 64

**Geometric (power of 2):**
- 4, 8, 16, 32, 64, 128

**Fibonacci:**
- 8, 13, 21, 34, 55, 89

**Material Design (4dp grid):**
- 4, 8, 12, 16, 20, 24, 32, 40, 48

**iOS (8pt grid):**
- 8, 16, 24, 32, 48, 64

## Reference

**Standards:**
- iOS HIG: Layout
- Material Design: Spacing methods
- 8-point grid system (most common)

**Metrics:**
- Base unit: 4pt or 8pt
- Touch targets: 44pt minimum (requires adequate spacing)
- Reading comfort: 16-24pt between paragraphs
- Visual grouping: ~0.5-1.5x base unit within groups, 2-4x between groups

Apply this skill to every screen to detect spacing patterns and identify where spacing breaks from established system.
