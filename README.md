# maestro-mcp

MCP server for [Maestro](https://maestro.mobile.dev/) mobile testing framework - control iOS/Android apps with 47+ automation tools through Claude Code.

## Features

- **47 MCP Tools** - Complete coverage of Maestro CLI capabilities
- **Auto-install** - Automatically installs Maestro CLI on first use
- **iOS & Android** - Full support for simulators, emulators, and real devices
- **AI-Powered Testing** - AI assertions and defect detection
- **Skills** - YAML flow syntax guide and mobile testing best practices
- **Commands** - `/run-flow`, `/record`, `/studio`, `/validate`
- **Agents** - Flow generator and test analyzer

## Installation

### Prerequisites
- Node.js 18+
- Android SDK (for Android testing) or Xcode (for iOS testing)
- Connected device or running emulator/simulator

### Add to Claude Code

```bash
# Install from local marketplace
claude plugins add local:maestro-mcp
```

Or add manually to your Claude Code config:

```json
{
  "mcpServers": {
    "maestro": {
      "command": "node",
      "args": ["/path/to/maestro-mcp/mcp/dist/index.js"]
    }
  }
}
```

## MCP Tools (47 total)

### Flow Execution (8)
| Tool | Description |
|------|-------------|
| `maestro_run_flow` | Execute a YAML flow file |
| `maestro_run_flows` | Execute multiple flows in sequence |
| `maestro_test` | Run flow with test assertions |
| `maestro_record` | Record device interactions to YAML |
| `maestro_validate_flow` | Validate YAML syntax |
| `maestro_upload` | Upload flow to Maestro Cloud |
| `maestro_download_flow` | Download flow from cloud |
| `maestro_create_flow` | Create new flow from template |

### Device Control (7)
| Tool | Description |
|------|-------------|
| `maestro_list_devices` | List connected devices/emulators |
| `maestro_connect_device` | Connect to specific device |
| `maestro_screenshot` | Capture device screenshot |
| `maestro_screen_recording_start` | Start screen recording |
| `maestro_screen_recording_stop` | Stop and save recording |
| `maestro_hierarchy` | Get UI element tree |
| `maestro_device_info` | Get device properties |

### App Lifecycle (6)
| Tool | Description |
|------|-------------|
| `maestro_launch_app` | Launch app by package ID |
| `maestro_stop_app` | Stop running app |
| `maestro_kill_app` | Force kill app |
| `maestro_clear_state` | Clear app data/cache |
| `maestro_clear_keychain` | Clear iOS keychain |
| `maestro_install_app` | Install APK/IPA |

### UI Interactions (12)
| Tool | Description |
|------|-------------|
| `maestro_tap` | Tap on element or coordinates |
| `maestro_double_tap` | Double tap gesture |
| `maestro_long_press` | Long press gesture |
| `maestro_input_text` | Type text into field |
| `maestro_erase_text` | Clear text from field |
| `maestro_swipe` | Swipe in direction |
| `maestro_scroll` | Scroll until element visible |
| `maestro_press_key` | Press device key |
| `maestro_hide_keyboard` | Hide on-screen keyboard |
| `maestro_open_link` | Open URL/deep link |
| `maestro_set_location` | Set GPS coordinates |
| `maestro_travel` | Simulate travel between locations |

### Assertions (6)
| Tool | Description |
|------|-------------|
| `maestro_assert_visible` | Assert element is visible |
| `maestro_assert_not_visible` | Assert element is hidden |
| `maestro_assert_true` | Assert condition is true |
| `maestro_wait_for` | Wait for element to appear |
| `maestro_extract_text` | Extract text from element |
| `maestro_copy_text` | Copy text to clipboard |

### System (5)
| Tool | Description |
|------|-------------|
| `maestro_set_orientation` | Set portrait/landscape |
| `maestro_toggle_airplane` | Toggle airplane mode |
| `maestro_set_airplane` | Set airplane mode on/off |
| `maestro_run_script` | Execute JavaScript |
| `maestro_eval_script` | Evaluate JS expression |

### AI-Powered (3)
| Tool | Description |
|------|-------------|
| `maestro_assert_with_ai` | AI-powered visual assertion |
| `maestro_extract_text_ai` | AI text extraction |
| `maestro_assert_no_defects` | AI defect detection |

## Commands

| Command | Description |
|---------|-------------|
| `/maestro-mcp:run-flow` | Execute a Maestro YAML flow file |
| `/maestro-mcp:record` | Start recording session |
| `/maestro-mcp:studio` | Launch Maestro Studio IDE |
| `/maestro-mcp:validate` | Validate YAML syntax |

## Agents

### flow-generator
Generates Maestro YAML flows from natural language descriptions.

**Trigger:** "Create a flow that logs in and adds item to cart"

### test-analyzer
Analyzes failed tests and suggests fixes.

**Trigger:** "Why did my login test fail?"

## Skills

### maestro-flows
YAML flow syntax guide, command reference, and examples.

**Trigger:** "How do I write a Maestro flow?"

### mobile-testing
Mobile testing best practices, debugging, and CI/CD setup.

**Trigger:** "How do I set up mobile testing in CI?"

## Usage Examples

### Run a test flow
```
Use maestro_run_flow to execute login-test.yaml
```

### Generate a flow from description
```
Create a Maestro flow that:
1. Opens the app
2. Taps the login button
3. Enters username and password
4. Submits the form
5. Verifies the home screen appears
```

### Debug a failing test
```
My checkout test is failing with "Element not found".
Analyze the test output and suggest fixes.
```

## Development

```bash
# Build MCP server
cd mcp
pnpm install
pnpm build

# Test locally
node dist/index.js
```

## License

MIT
