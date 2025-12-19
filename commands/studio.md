---
description: Launch Maestro Studio visual IDE for flow development
argument-hint: [--port <port>]
allowed-tools: [Bash]
---

# studio

Launch Maestro Studio, a web-based visual IDE for creating and debugging test flows.

## Instructions

When this command is invoked:

1. **Parse port argument (optional)**
   - Default port: 9999
   - If user provides `--port <number>`, use that port
   - Validate port is between 1024-65535

2. **Check device connectivity**
   ```bash
   maestro hierarchy
   ```
   - Studio requires a connected device/emulator
   - If none found: "Connect device or start emulator before launching Studio"

3. **Launch Maestro Studio**
   ```bash
   maestro studio --port=<port>
   ```
   - This starts the Studio web server
   - Runs in foreground (does not return until stopped)
   - Should be run with run_in_background: true

4. **Report access information**
   Display immediately after launch:
   ```
   Maestro Studio launched successfully

   Access at: http://localhost:<port>
   Device: <device-name> (<device-id>)

   Features available:
   - Visual flow builder with drag-and-drop commands
   - Live device preview and interaction
   - Real-time flow execution and debugging
   - Element inspector (tap elements to get selectors)
   - Flow export to YAML

   Press Ctrl+C to stop Studio server
   ```

5. **Background execution**
   - Use Bash with run_in_background: true
   - Inform user: "Studio running in background. Use task manager to stop if needed"

6. **Error handling**
   - Port already in use: "Port <port> busy. Try /studio --port <other-port>"
   - No device: "Studio requires connected device. Start emulator first"
   - Studio not installed: "maestro studio requires Maestro CLI. Install via https://maestro.mobile.dev"

## Expected Output Format

```
Launching Maestro Studio...

✓ Studio server started
✓ Device connected: Pixel 5 API 33 (emulator-5554)

Access Maestro Studio at: http://localhost:9999

Features:
• Drag-and-drop flow builder
• Live device mirroring
• Element inspector (click to select)
• Instant flow execution
• Export flows to YAML

Running in background. Press Ctrl+C to stop.
```

## Studio Capabilities

Briefly explain to user:
- **Visual Builder**: Create flows without writing YAML
- **Element Inspector**: Click device elements to capture selectors
- **Live Testing**: Run flows instantly with visual feedback
- **Device Control**: Control device directly from browser
- **Export**: Generate clean YAML from visual flows

## Usage Examples

```bash
/studio
/studio --port 8080
/studio --port 3000
```
