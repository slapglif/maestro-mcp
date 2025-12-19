---
description: Execute a Maestro YAML flow file on connected device or emulator
argument-hint: <flow-file.yaml> [--device <device-id>]
allowed-tools: [Bash, Read, Write]
---

# run-flow

Execute a Maestro test flow on a connected Android/iOS device or emulator.

## Instructions

When this command is invoked:

1. **Validate the flow file exists**
   - Use Read tool to confirm the YAML file path provided
   - If path is relative, resolve from current working directory
   - If file not found, report error with available .yaml files in current directory

2. **Check for connected devices**
   ```bash
   maestro test --dry-run <flow-file>
   ```
   - This verifies device connectivity without running the flow
   - If no device found, instruct user to connect device or start emulator

3. **Execute the flow**
   ```bash
   maestro test <flow-file>
   ```
   - If `--device <device-id>` argument provided, add `--device=<device-id>`
   - Capture full output including:
     - Flow steps executed
     - Pass/fail status
     - Screenshots if generated
     - Execution time

4. **Report results**
   - Parse maestro output for:
     - Total steps: X
     - Passed: Y
     - Failed: Z
     - Duration: Ns
   - If failed, extract failing step and error message
   - List any generated artifacts (screenshots, videos)
   - Use rich formatting with clear success/failure indication

5. **Error handling**
   - Device not connected: "No device found. Start emulator or connect device via USB/WiFi"
   - YAML syntax errors: Show specific line and validation error
   - Flow execution errors: Show failing command with context
   - Timeout: Report which step timed out

## Expected Output Format

```
Executing flow: login-test.yaml
Device: Pixel 5 (emulator-5554)

✓ Launch app com.example.app
✓ Tap "Login"
✓ Input text "user@test.com" into Email field
✗ Tap "Submit" - Element not found

Results: 3/4 steps passed (75%)
Duration: 12.3s
Failed at step 4: Element 'Submit' not visible
```

## Usage Examples

```bash
/run-flow tests/login.yaml
/run-flow onboarding.yaml --device emulator-5554
/run-flow flows/checkout.yaml --device 192.168.1.100
```
