# Maestro MCP Server

MCP server implementation for the Maestro mobile testing framework. Provides 47 tools for mobile app testing automation.

## Installation

```bash
pnpm install
pnpm build
```

## Usage

The server runs on stdio and can be used with any MCP client:

```bash
node dist/index.js
```

## Features

### Auto-Install Maestro
The server automatically checks for and installs the Maestro CLI on first use if not already installed.

### 47 Tools Organized into Categories

#### Flow Execution (8 tools)
- `maestro_run_flow` - Execute a YAML flow file
- `maestro_run_flows` - Execute multiple flows
- `maestro_test` - Run with assertions and reporting
- `maestro_record` - Record user interactions
- `maestro_validate_flow` - Validate YAML syntax
- `maestro_upload` - Upload to Maestro Cloud
- `maestro_download_flow` - Download from cloud
- `maestro_create_flow` - Create from template (basic, login, navigation, form)

#### Device Control (7 tools)
- `maestro_list_devices` - List devices/emulators
- `maestro_connect_device` - Connect to device
- `maestro_screenshot` - Capture screenshot
- `maestro_screen_recording_start` - Start recording
- `maestro_screen_recording_stop` - Stop recording
- `maestro_hierarchy` - Get UI element tree
- `maestro_device_info` - Get device information

#### App Lifecycle (6 tools)
- `maestro_launch_app` - Launch application
- `maestro_stop_app` - Stop gracefully
- `maestro_kill_app` - Force kill
- `maestro_clear_state` - Clear app data/cache
- `maestro_clear_keychain` - Clear iOS keychain
- `maestro_install_app` - Install APK/IPA

#### UI Interactions (12 tools)
- `maestro_tap` - Tap element or coordinates
- `maestro_double_tap` - Double tap
- `maestro_long_press` - Long press with duration
- `maestro_input_text` - Type text
- `maestro_erase_text` - Clear text
- `maestro_swipe` - Swipe gesture
- `maestro_scroll` - Scroll direction
- `maestro_press_key` - Press device key
- `maestro_hide_keyboard` - Hide keyboard
- `maestro_open_link` - Open URL/deep link
- `maestro_set_location` - Set GPS location
- `maestro_travel` - Simulate GPS travel

#### Assertions (6 tools)
- `maestro_assert_visible` - Assert element visible
- `maestro_assert_not_visible` - Assert element hidden
- `maestro_assert_true` - Assert condition
- `maestro_wait_for` - Wait for element
- `maestro_extract_text` - Extract text from element
- `maestro_copy_text` - Copy to clipboard

#### System (5 tools)
- `maestro_set_orientation` - Portrait/landscape
- `maestro_toggle_airplane` - Toggle airplane mode
- `maestro_set_airplane` - Set airplane on/off
- `maestro_run_script` - Run JavaScript
- `maestro_eval_script` - Eval JS expression

#### AI-Powered (3 tools)
- `maestro_assert_with_ai` - AI visual assertions
- `maestro_extract_text_ai` - AI text extraction
- `maestro_assert_no_defects` - AI defect detection

## Architecture

### Helper Functions

**ensureMaestro()**: Checks if Maestro CLI is installed. If not, downloads and installs it automatically using the official installation script.

**runMaestro()**: Executes Maestro CLI commands using `child_process.spawn`, capturing stdout/stderr and exit codes.

### Tool Handlers

Each tool creates temporary YAML flow files to execute Maestro commands, then cleans up after execution. This approach:
- Enables all Maestro features through standard flow syntax
- Provides structured error handling
- Maintains state isolation between calls
- Works with any device configuration

### Response Format

All tools return JSON with:
```json
{
  "success": true/false,
  "output": "stdout from maestro",
  "error": "stderr if any",
  // tool-specific fields
}
```

## Examples

### Launch App
```json
{
  "name": "maestro_launch_app",
  "arguments": {
    "appId": "com.example.app",
    "clearState": true
  }
}
```

### Run Flow with Environment Variables
```json
{
  "name": "maestro_run_flow",
  "arguments": {
    "flowFile": "/path/to/test.yaml",
    "env": {
      "USERNAME": "testuser",
      "PASSWORD": "testpass"
    }
  }
}
```

### Create Flow from Template
```json
{
  "name": "maestro_create_flow",
  "arguments": {
    "output": "/path/to/new-flow.yaml",
    "template": "login",
    "appId": "com.example.app"
  }
}
```

### AI-Powered Assertion
```json
{
  "name": "maestro_assert_with_ai",
  "arguments": {
    "prompt": "The login button should be visible and enabled"
  }
}
```

## Development

### Build
```bash
pnpm build
```

### Watch Mode
```bash
pnpm dev
```

### Test Server
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

## Requirements

- Node.js 20+
- Maestro CLI (auto-installed)
- Android SDK or iOS simulator for device testing

## License

See parent project LICENSE
