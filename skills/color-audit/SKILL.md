# Color Audit (Palette Extraction and Consistency Analysis)

Use when analyzing app color usage, extracting color palettes, calculating contrast ratios, or identifying color consistency issues across screens.

## Purpose

Extract and analyze the complete color palette from mobile app screenshots to detect:
- Primary, secondary, and accent colors
- Color usage patterns and frequency
- Contrast ratio compliance between color pairs
- Inconsistencies in color application
- Color accessibility issues
- Brand color adherence

## Hermeneutic Context

Color is meaning-making. A color gains significance through its relationships:
- **Part-to-Whole:** A button color → Color system → Brand identity
- **Relationships:** Primary color → Contrast with background → Semantic meaning (success/error/warning)
- **Context:** Same hex value → Different perceived colors in different contexts (surrounding colors affect perception)

A "brand color" isn't just a hex value - it's how consistently that value appears, what roles it plays, and whether its usage reinforces user understanding.

## Inputs Required

1. **Screenshot path** - Full screen capture for color extraction
2. **UI hierarchy** - Element tree to associate colors with UI components
3. **Design system constraints** (optional) - Expected colors:
   ```json
   {
     "brand": {
       "colors": {
         "primary": "#1E88E5",
         "secondary": "#FFC107",
         "accent": null,
         "error": "#D32F2F",
         "success": "#388E3C",
         "warning": "#F57C00"
       }
     }
   }
   ```
4. **Previous screen colors** (optional) - For cross-screen consistency analysis

## Analysis Process

### Step 1: Color Extraction

**Quantization Strategy:**
Extract dominant colors using clustering (k-means or median cut):

1. Load screenshot
2. Reduce to significant colors (typically 8-16 clusters)
3. Filter out near-whites (#F0F0F0+), near-blacks (#0F0F0F-), and near-grays (saturation < 10%)
4. Calculate color frequency (pixel count per cluster)
5. Sort by frequency

**Visual Analysis:**
Use Claude Vision to identify color roles:

```
Analyze this mobile app screenshot. Identify:

1. Primary brand colors (most prominent non-neutral colors)
2. Background colors (large surfaces)
3. Text colors (readable foreground colors)
4. Interactive element colors (buttons, links, toggles)
5. Status/semantic colors (success green, error red, warning yellow)
6. Accent colors (used sparingly for emphasis)

For each color, describe:
- Approximate hex value (e.g., "blue #1E88E5")
- Where it appears (e.g., "primary button backgrounds")
- Frequency (dominant, common, occasional, rare)
```

### Step 2: Color Clustering and Naming

**Auto-naming Convention:**
```python
def name_color(hex_value):
    h, s, v = rgb_to_hsv(hex_to_rgb(hex_value))

    # Base hue name
    hue_name = {
        (0, 15): "red", (15, 45): "orange", (45, 70): "yellow",
        (70, 155): "green", (155, 200): "cyan", (200, 260): "blue",
        (260, 290): "purple", (290, 330): "magenta", (330, 360): "red"
    }[find_range(h)]

    # Saturation modifier
    if s < 10:
        return f"gray_{v}"
    elif s < 30:
        prefix = "pale_"
    elif s < 60:
        prefix = ""
    else:
        prefix = "vivid_"

    # Value modifier
    if v < 30:
        suffix = "_dark"
    elif v > 70:
        suffix = "_light"
    else:
        suffix = ""

    return f"{prefix}{hue_name}{suffix}"

# Examples:
# #1E88E5 → "blue"
# #90CAF9 → "blue_light"
# #0D47A1 → "blue_dark"
# #FFC107 → "yellow"
```

### Step 3: Contrast Matrix

Calculate contrast ratios between all extracted colors:

```python
def build_contrast_matrix(colors):
    matrix = {}

    for c1 in colors:
        matrix[c1.hex] = {}
        for c2 in colors:
            if c1 == c2:
                continue

            ratio = calculate_contrast(c1, c2)
            matrix[c1.hex][c2.hex] = {
                "ratio": round(ratio, 2),
                "wcag_aa_normal": ratio >= 4.5,
                "wcag_aa_large": ratio >= 3.0,
                "wcag_aaa_normal": ratio >= 7.0,
                "wcag_aaa_large": ratio >= 4.5
            }

    return matrix
```

**Output:**
```json
{
  "contrast_pairs": [
    {
      "fg": "#1E88E5",
      "bg": "#FFFFFF",
      "ratio": 4.37,
      "sufficient_for": ["large_text_aa"],
      "insufficient_for": ["normal_text_aa"],
      "severity": "warning"
    },
    {
      "fg": "#FFFFFF",
      "bg": "#1E88E5",
      "ratio": 4.37,
      "sufficient_for": ["large_text_aa"],
      "insufficient_for": ["normal_text_aa"],
      "severity": "warning"
    }
  ]
}
```

### Step 4: Color Role Detection

Map colors to semantic roles by analyzing usage:

```python
def detect_color_roles(screenshot, hierarchy, colors):
    roles = {}

    for color in colors:
        # Find elements using this color
        elements = find_elements_with_color(screenshot, hierarchy, color)

        role_candidates = []

        # Primary: Used for main interactive elements, appears frequently
        if any(e.type == "button" and e.is_primary for e in elements):
            role_candidates.append(("primary", 0.9))

        # Background: Covers large area, low saturation
        if color.coverage_percent > 20 and color.saturation < 0.2:
            role_candidates.append(("background", 0.8))

        # Text: High contrast with background, small areas
        if any(e.type == "text" for e in elements):
            role_candidates.append(("text", 0.7))

        # Error: Red hue, used on error messages/icons
        if 345 <= color.hue <= 15 and any("error" in e.id.lower() for e in elements):
            role_candidates.append(("error", 0.95))

        # Select highest confidence role
        roles[color.hex] = max(role_candidates, key=lambda x: x[1])[0] if role_candidates else "decorative"

    return roles
```

### Step 5: Consistency Analysis

Compare color usage across screens:

**Clustering Tolerance:**
Colors within ΔE < 5 (perceptual difference) are considered the "same color":

```python
def find_color_drift(screen_colors, all_screens):
    drift_issues = []

    for color in screen_colors:
        # Find similar colors across screens
        similar = [
            c for screen in all_screens
            for c in screen.colors
            if delta_e(color, c) < 5 and color.hex != c.hex
        ]

        if len(similar) > 0:
            drift_issues.append({
                "intended": color.hex,
                "variations": [c.hex for c in similar],
                "screens": [c.screen_id for c in similar],
                "severity": "warning",
                "recommendation": f"Consolidate to single value: {color.hex}"
            })

    return drift_issues
```

**Role Consistency:**
Same role should use same color:

```python
def check_role_consistency(all_screens):
    role_colors = defaultdict(set)

    for screen in all_screens:
        for color, role in screen.color_roles.items():
            role_colors[role].add(color)

    issues = []
    for role, colors in role_colors.items():
        if len(colors) > 1:
            issues.append({
                "role": role,
                "colors": list(colors),
                "severity": "warning" if role in ["primary", "error", "success"] else "info",
                "recommendation": f"Use consistent color for '{role}' role across all screens"
            })

    return issues
```

## Output Format

```json
{
  "screen_id": "screen_001",
  "screen_name": "Home Screen",
  "timestamp": "2024-12-19T10:30:00Z",
  "palette": [
    {
      "hex": "#1E88E5",
      "rgb": [30, 136, 229],
      "hsl": [207, 79, 51],
      "name": "blue",
      "role": "primary",
      "frequency": 0.15,
      "coverage_percent": 15,
      "locations": [
        "Primary button backgrounds (3x)",
        "Active tab indicator",
        "Link text (5x)"
      ]
    },
    {
      "hex": "#FFC107",
      "rgb": [255, 193, 7],
      "hsl": [45, 100, 51],
      "name": "yellow",
      "role": "accent",
      "frequency": 0.03,
      "coverage_percent": 3,
      "locations": [
        "Notification badge",
        "Star rating icon"
      ]
    },
    {
      "hex": "#FFFFFF",
      "rgb": [255, 255, 255],
      "hsl": [0, 0, 100],
      "name": "white",
      "role": "background",
      "frequency": 0.60,
      "coverage_percent": 60,
      "locations": ["Screen background"]
    }
  ],
  "contrast_analysis": [
    {
      "pair": ["#1E88E5", "#FFFFFF"],
      "ratio": 4.37,
      "compliant": {
        "aa_normal_text": false,
        "aa_large_text": true,
        "aa_ui_components": true
      },
      "usage_context": "Blue button text on white background",
      "severity": "warning",
      "recommendation": "Darken blue to #1565C0 for AA compliance (ratio 7.0)"
    }
  ],
  "consistency_issues": [
    {
      "type": "color_drift",
      "description": "Primary blue has 2 variations",
      "colors": ["#1E88E5", "#1976D2"],
      "screens": ["screen_001", "screen_003"],
      "delta_e": 3.2,
      "severity": "warning",
      "recommendation": "Standardize to #1E88E5 across all screens"
    },
    {
      "type": "role_inconsistency",
      "description": "Error color varies across screens",
      "role": "error",
      "colors": ["#D32F2F", "#F44336"],
      "severity": "warning",
      "recommendation": "Use single error color (#D32F2F) consistently"
    }
  ],
  "brand_adherence": {
    "expected_colors": {
      "primary": "#1E88E5",
      "secondary": "#FFC107"
    },
    "found_colors": {
      "primary": ["#1E88E5", "#1976D2"],
      "secondary": ["#FFC107"]
    },
    "adherence_score": 75,
    "violations": [
      {
        "color": "#1976D2",
        "expected": "#1E88E5",
        "delta_e": 3.2,
        "locations": ["Settings screen primary button"]
      }
    ]
  },
  "hermeneutic_notes": [
    "Blue (#1E88E5) consistently used for primary actions across 3 screens - strong pattern",
    "Yellow accent color used sparingly and appropriately for notifications",
    "Color drift detected: primary blue varies slightly (ΔE=3.2) on Settings screen",
    "No semantic status colors detected (no explicit error/success/warning colors)"
  ]
}
```

## Visual Analysis with Claude Vision

**Prompt Template:**

```
Analyze the color usage in this mobile app screenshot.

1. DOMINANT COLORS:
   List the 5-8 most prominent colors (exclude white/black/gray unless they're styled grays).
   For each color, estimate:
   - Hex value (approximate)
   - Where it appears
   - How much screen space it covers

2. COLOR ROLES:
   Identify which colors serve these purposes:
   - Primary action (main buttons, active states)
   - Secondary action
   - Background / surface colors
   - Text colors (body, headings, secondary text)
   - Status colors (error, success, warning, info)
   - Decorative / accent colors

3. VISUAL HIERARCHY:
   Does color use effectively guide attention?
   - Is the most important action clearly distinguished by color?
   - Are interactive elements visually distinct from static content?

4. CONSISTENCY:
   Within this single screen:
   - Are similar elements using similar colors?
   - Are different element types using distinct colors?
   - Any unexpected color variations?

5. ACCESSIBILITY:
   Visual assessment (not precise calculation):
   - Any color combinations that look low contrast?
   - Any very light text on light backgrounds?
   - Any reliance on color alone to convey information?

Context: [Screen name/purpose from hierarchy]
Previous screens: [Brief summary of color patterns from earlier screens]
```

## Integration with Visual Inspector

```yaml
# Visual Inspector calls color audit for each screen
- capture_screen: screen_001
- run_skill: /color-audit
  inputs:
    screenshot: screen_001.png
    hierarchy: screen_001_hierarchy.json
    design_system: design_system.brand.colors
    previous_screens: [screen_000]

# Update design system with discovered colors
- if: color_audit.palette contains new_color
  then:
    - update_constraint:
        path: "discovered_patterns.colors"
        value: color_audit.palette
        evidence: screen_001

# Build cross-screen analysis
- if: screen_count >= 3
  then:
    - analyze_color_consistency:
        screens: [screen_000, screen_001, screen_002]
        output: color_consistency_report
```

## Best Practices

### Do:
- Extract colors from actual screenshots, not hierarchy metadata alone
- Consider perceptual color difference (ΔE), not just hex values
- Analyze color in context of surrounding colors
- Compare across screens to detect patterns vs. anomalies
- Provide specific hex values and contrast ratios

### Don't:
- Report every slight shade variation as an issue (use ΔE threshold)
- Ignore neutral colors (whites, grays, blacks) - they're part of the palette
- Analyze colors in isolation from their usage context
- Assume color names (e.g., "blue") convey precise meaning - always include hex

## Color Perception Calculations

**Contrast Ratio:**
```python
def relative_luminance(r, g, b):
    """Convert RGB (0-255) to relative luminance"""
    def linearize(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    R, G, B = linearize(r), linearize(g), linearize(b)
    return 0.2126 * R + 0.7152 * G + 0.0722 * B

def contrast_ratio(color1, color2):
    """Calculate WCAG contrast ratio"""
    L1 = relative_luminance(*color1)
    L2 = relative_luminance(*color2)
    return (max(L1, L2) + 0.05) / (min(L1, L2) + 0.05)
```

**Perceptual Difference (ΔE2000):**
```python
def delta_e_2000(lab1, lab2):
    """
    Calculate ΔE2000 color difference
    ΔE < 1: Not perceptible
    ΔE 1-5: Perceptible through close observation
    ΔE > 5: Clearly different colors
    """
    # Implement CIE ΔE2000 formula
    # (Complex calculation - use colormath or colorsys library)
    pass
```

**Color Space Conversions:**
```python
import colorsys

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_hsl(r, g, b):
    return colorsys.rgb_to_hls(r/255, g/255, b/255)

def rgb_to_lab(r, g, b):
    # Convert RGB → XYZ → LAB
    # LAB is perceptually uniform color space
    pass
```

## Reference

**Standards:**
- WCAG 2.1: Contrast requirements
- Material Design: Color system guidelines
- Apple HIG: Color and contrast

**Tools:**
- Color quantization: k-means clustering, median cut algorithm
- Perceptual difference: CIE ΔE2000 formula
- Contrast: WCAG relative luminance formula

Apply this skill to every screen to build comprehensive color profile and detect systemic vs. isolated color issues.
