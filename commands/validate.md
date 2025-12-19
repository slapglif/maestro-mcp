---
description: Validate Maestro YAML flow syntax without running
argument-hint: <flow-file.yaml>
allowed-tools: [Bash, Read]
---

# validate

Validate a Maestro flow file for syntax errors and command correctness without executing it.

## Instructions

When this command is invoked:

1. **Validate file exists**
   - Use Read tool to check the provided YAML file path
   - If not found, list available .yaml files in current directory
   - Resolve relative paths from current working directory

2. **Read the YAML file**
   - Load complete file contents with Read tool
   - Count total lines for reporting

3. **Run Maestro syntax validation**
   ```bash
   maestro test --dry-run <flow-file>
   ```
   - `--dry-run` validates without executing
   - Captures validation errors with line numbers
   - Checks YAML syntax and command validity

4. **Parse validation results**

   **If valid:**
   - Count number of commands/steps
   - Extract appId if present
   - List unique command types used (launchApp, tapOn, inputText, etc.)
   - Report: "✓ Valid Maestro flow with N steps"

   **If invalid:**
   - Extract error message
   - Identify line number if available
   - Show problematic line from file
   - Suggest correction if obvious (typo, indentation, etc.)

5. **Additional checks**
   - Verify YAML structure (must be array of commands)
   - Check for common mistakes:
     - Missing required parameters (e.g., tapOn without selector)
     - Invalid command names (suggest correct spelling)
     - Indentation errors
     - Invalid selector syntax
   - Warn about deprecated commands if detected

6. **Report format**

   **Success:**
   ```
   ✓ login-flow.yaml is valid

   Summary:
   - Total steps: 12
   - App ID: com.example.app
   - Commands used: launchApp, tapOn, inputText, assertVisible, scroll

   Ready to execute with: /run-flow login-flow.yaml
   ```

   **Failure:**
   ```
   ✗ login-flow.yaml has errors

   Line 15: Invalid command 'tapOn'
   > tapOn: "Login Button
           ^
   Error: Unterminated string

   Suggestion: Add closing quote
   > tapOn: "Login Button"
   ```

7. **Error handling**
   - File not found: List .yaml files in directory
   - Not a YAML file: "File must have .yaml extension"
   - Empty file: "Flow file is empty"
   - maestro not installed: "Install Maestro CLI from https://maestro.mobile.dev"

## Common Validation Issues to Detect

1. **Syntax errors**
   - Missing colons
   - Incorrect indentation
   - Unclosed quotes/brackets

2. **Invalid commands**
   - Typos (e.g., "tapOn" vs "tapon")
   - Deprecated commands
   - Unknown command names

3. **Missing parameters**
   - `tapOn` without selector
   - `inputText` without text value
   - `assertVisible` without element

4. **Invalid selectors**
   - Malformed regex
   - Invalid ID/text combinations
   - Missing selector entirely

## Expected Output Format

```
Validating: tests/login-flow.yaml

✓ YAML syntax valid
✓ All commands recognized
✓ Required parameters present
✓ Selectors well-formed

Flow summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
App: com.example.app
Steps: 8
Commands: launchApp(1), tapOn(3), inputText(2), assertVisible(2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Flow is ready to run: /run-flow tests/login-flow.yaml
```

## Usage Examples

```bash
/validate flows/login.yaml
/validate onboarding-test.yaml
/validate ../shared/checkout-flow.yaml
```
