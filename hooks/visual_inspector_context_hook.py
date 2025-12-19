#!/usr/bin/env python3
"""
Visual Inspector Context Hook for Maestro MCP
This hook injects design-system constraints into context when visual inspection tools are used.
Reads from the same design-system.json file that the MCP tools use.
"""

import json
import os
import sys
import tempfile

# Path to design system file (must match visual-inspector.ts CONSTRAINTS_FILE)
INSPECTOR_DIR = os.path.join(tempfile.gettempdir(), "maestro-inspector")
CONSTRAINTS_FILE = os.path.join(INSPECTOR_DIR, "design-system.json")


def get_default_design_system() -> dict:
    """Default design system when no file exists."""
    return {
        "brand": {
            "colors": {},
            "typography": {},
            "spacing": {"unit": 8, "scale": [4, 8, 16, 24, 32, 48]},
        },
        "accessibility": {
            "min_contrast": 4.5,
            "min_touch_target": 44,
            "require_labels": True,
        },
        "discovered_patterns": [],
    }


def load_design_system() -> dict:
    """Load design system from filesystem (same source as MCP tools)."""
    if os.path.exists(CONSTRAINTS_FILE):
        try:
            with open(CONSTRAINTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return get_default_design_system()


def format_design_system_context(ds: dict) -> str:
    """Format design system as context for Claude."""
    brand = ds.get("brand", {})
    accessibility = ds.get("accessibility", {})
    patterns = ds.get("discovered_patterns", [])

    # Format colors
    colors = brand.get("colors", {})
    color_lines = []
    if colors:
        for name, value in colors.items():
            color_lines.append(f"  - {name}: {value}")
    else:
        color_lines.append("  - (none discovered yet)")

    # Format typography
    typography = brand.get("typography", {})
    typo_lines = []
    if typography:
        for name, value in typography.items():
            typo_lines.append(f"  - {name}: {value}")
    else:
        typo_lines.append("  - (none discovered yet)")

    # Format spacing
    spacing = brand.get("spacing", {"unit": 8, "scale": [4, 8, 16, 24, 32, 48]})
    spacing_unit = spacing.get("unit", 8)
    spacing_scale = spacing.get("scale", [])

    # Format accessibility
    min_contrast = accessibility.get("min_contrast", 4.5)
    min_touch = accessibility.get("min_touch_target", 44)
    require_labels = accessibility.get("require_labels", True)

    # Format discovered patterns
    pattern_lines = []
    if patterns:
        for p in patterns:
            ptype = p.get("type", "unknown")
            screens = len(p.get("screens", []))
            pattern_lines.append(f"  - {ptype} (seen on {screens} screens)")
    else:
        pattern_lines.append("  - (none discovered yet)")

    return f"""📐 **Design System Verification Active**

Before analyzing this screen/component, check against these design system constraints:

**Colors (from design-system.json):**
{chr(10).join(color_lines)}
- Verify color consistency across components
- Check contrast ratios meet WCAG AA ({min_contrast}:1 minimum)

**Typography:**
{chr(10).join(typo_lines)}
- Font sizes should follow {spacing_unit}px scale
- Verify hierarchy and consistency

**Spacing:**
- Base unit: {spacing_unit}px
- Scale: {', '.join(str(s) for s in spacing_scale)}
- Verify padding/margins align to grid
- Check component spacing consistency

**Accessibility (constraints):**
- Touch targets: minimum {min_touch}x{min_touch} points
- Labels required: {require_labels}
- Contrast: minimum {min_contrast}:1 for normal text, 3:1 for large text
- Focus indicators: visible and clear

**Discovered Patterns:**
{chr(10).join(pattern_lines)}

**Analysis Questions:**
1. Does this component/screen match the design system?
2. Are there any inconsistencies with previously seen screens?
3. Are accessibility requirements met?
4. What patterns or components are being used?
5. Should any new patterns be added using maestro_update_constraint?

Use the /a11y-check, /color-audit, /typography-audit, and /spacing-audit skills for detailed analysis.
"""


def main():
    """Main hook function - injects design system context for visual inspection tools."""
    try:
        # Read input from stdin
        raw_input = sys.stdin.read()
        input_data = json.loads(raw_input)
    except json.JSONDecodeError:
        # If we can't parse input, allow tool to proceed
        sys.exit(0)

    # Extract tool information
    tool_name = input_data.get("tool_name", "")

    # Only inject context for visual inspection tools
    visual_inspection_tools = [
        "maestro_capture_screen",
        "maestro_hierarchy",
        "maestro_focus_region",
    ]

    if tool_name not in visual_inspection_tools:
        sys.exit(0)  # Allow non-visual tools to proceed without context

    # Load design system from filesystem (same source as MCP tools)
    ds = load_design_system()

    # Format and output context
    context = format_design_system_context(ds)
    print(context, file=sys.stderr)

    # Exit with code 0 to allow tool to proceed (this is informational, not blocking)
    sys.exit(0)


if __name__ == "__main__":
    main()
