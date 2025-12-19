---
description: Start Maestro recording session to capture device interactions as YAML
argument-hint: [output-file.yaml]
allowed-tools: [Bash, Write]
---

# record

Record device interactions and generate a Maestro YAML flow file.

## Instructions

When this command is invoked:

1. **Determine output filename**
   - If user provides filename argument, use it
   - If no argument, use `recorded-flow-<timestamp>.yaml`
   - Ensure filename ends with `.yaml` extension
   - If file exists, confirm before overwriting

2. **Check device connectivity**
   ```bash
   maestro hierarchy
   ```
   - Verify at least one device is connected
   - If none, error: "No device connected. Start emulator or connect via USB/WiFi"

3. **Start recording session**
   ```bash
   maestro record <output-file>
   ```
   - This launches interactive recording mode
   - Maestro will track all device interactions

4. **Instruct the user**
   Display immediately:
   ```
   Recording started. Maestro is capturing your interactions.

   Instructions:
   - Interact with your device/emulator normally
   - All taps, swipes, and text input will be recorded
   - Press Ctrl+C when finished to save the flow

   Output will be saved to: <output-file>
   ```

5. **Wait for completion**
   - Recording runs until user stops it (Ctrl+C)
   - Maestro automatically saves the YAML file

6. **Post-recording**
   - Read the generated YAML file
   - Display formatted preview (first 20 lines)
   - Report file location and size
   - Suggest: "Use /validate <file> to check syntax"

7. **Error handling**
   - Device disconnected during recording: "Device lost. Partial flow may be saved"
   - Permission denied: "Maestro needs accessibility/input permissions"
   - Recording cancelled: Report if partial file was saved

## Expected Output Format

```
Starting Maestro recording session...
Device: Pixel 5 (emulator-5554)

Recording in progress. Interact with your device.
Press Ctrl+C to stop and save.

[User performs interactions]

Recording stopped.
Saved flow to: login-flow.yaml (847 bytes)

Preview:
---
appId: com.example.app
---
- launchApp
- tapOn: "Login"
- inputText: "user@example.com"
- tapOn:
    id: "submit_button"
...

Next: /run-flow login-flow.yaml to test this flow
```

## Usage Examples

```bash
/record
/record login-test.yaml
/record flows/user-registration.yaml
```
