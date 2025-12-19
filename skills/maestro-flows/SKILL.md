# Maestro Flow Development

Use when writing Maestro YAML test flows, understanding flow syntax, or needing command reference for mobile app automation.

## Flow Structure

Every Maestro flow is a YAML file defining automated interactions with a mobile app. Structure flows with three essential components: app identifier, environment setup, and command sequence.

### Basic Flow Anatomy

```yaml
appId: com.example.app
---
- launchApp
- tapOn: "Login"
- inputText: "user@example.com"
- tapOn: "Submit"
- assertVisible: "Welcome"
```

The `appId` header specifies the bundle identifier (iOS) or package name (Android). The triple dash `---` separates metadata from commands. Commands execute sequentially, failing fast on errors.

## Core Commands

### Navigation Commands

**launchApp** - Launch the target application with optional arguments:

```yaml
- launchApp:
    appId: com.example.app  # Override default appId
    clearState: true        # Clear app data before launch
    clearKeychain: true     # Clear iOS keychain (iOS only)
    permissions:
      all: allow            # Grant all permissions
```

Use `clearState` for test isolation between runs. Grant permissions upfront to avoid runtime dialogs.

**back** - Navigate back (Android back button or iOS navigation):

```yaml
- back
```

**swipe** - Directional swipe gestures:

```yaml
- swipe:
    direction: UP           # UP, DOWN, LEFT, RIGHT
    duration: 500          # Milliseconds

- swipe:
    start: 50%, 80%        # Start coordinates (x%, y%)
    end: 50%, 20%          # End coordinates
```

**scroll** - Scroll until element visible:

```yaml
- scroll
- scrollUntilVisible:
    element:
      text: "Settings"
    direction: DOWN
    timeout: 10000
```

### Interaction Commands

**tapOn** - Tap elements by various selectors:

```yaml
# By text content
- tapOn: "Submit"

# By resource ID
- tapOn:
    id: "login_button"

# By accessibility label
- tapOn:
    accessibilityLabel: "Login Button"

# By index (when multiple matches)
- tapOn:
    text: "Edit"
    index: 0

# Long press
- tapOn:
    id: "item"
    longPress: true

# Tap coordinates
- tapOn:
    point: "50%,80%"
```

Always prefer stable selectors (id, accessibilityLabel) over fragile ones (text, coordinates). Use index only when necessary.

**inputText** - Enter text into focused input:

```yaml
- tapOn:
    id: "email_field"
- inputText: "user@example.com"

# Input with variables
- inputText: "${EMAIL}"

# Input with special keys
- inputText: "password123\n"  # \n sends Enter
```

Tap the input field before `inputText`. The command types into whatever has focus.

**eraseText** - Clear text from input:

```yaml
- eraseText:
    charactersToErase: 10  # Delete N characters

- eraseText  # Clear entire field
```

### Assertion Commands

**assertVisible** - Verify element exists and is visible:

```yaml
- assertVisible: "Login Successful"

- assertVisible:
    id: "success_message"
    timeout: 5000

# Assert NOT visible
- assertNotVisible:
    text: "Error"
```

Assertions fail the flow immediately if condition not met. Use `timeout` for elements appearing after async operations.

**assertTrue** - Evaluate conditions:

```yaml
- assertTrue: ${USER_LOGGED_IN}

- assertTrue:
    condition: "${RESPONSE_CODE} == 200"
    timeout: 3000
```

Useful for validating state after complex interactions.

### Wait Commands

**waitForAnimationToEnd** - Wait for UI animations:

```yaml
- waitForAnimationToEnd:
    timeout: 3000
```

Critical after transitions, before assertions on new screens.

**extendedWaitUntil** - Wait for conditions:

```yaml
- extendedWaitUntil:
    visible: "Loading complete"
    timeout: 30000

- extendedWaitUntil:
    notVisible: "Spinner"
```

Use for loading states, async data fetching.

## Element Selectors

Maestro supports multiple selector strategies. Choose based on stability and reliability.

### Selector Priority

1. **Resource ID** (most stable):
```yaml
- tapOn:
    id: "login_button"
```

2. **Accessibility Label** (stable, accessibility-friendly):
```yaml
- tapOn:
    accessibilityLabel: "Login Button"
```

3. **Text Content** (fragile, localization issues):
```yaml
- tapOn: "Submit"
- tapOn:
    text: "Submit"
```

4. **Coordinates** (most fragile, device-dependent):
```yaml
- tapOn:
    point: "50%,80%"
```

### Selector Modifiers

**index** - Select from multiple matches:
```yaml
- tapOn:
    text: "Edit"
    index: 1  # Zero-indexed
```

**below/above/leftOf/rightOf** - Relative positioning:
```yaml
- tapOn:
    text: "Delete"
    below:
      text: "John Doe"
```

**enabled** - Filter by enabled state:
```yaml
- tapOn:
    text: "Submit"
    enabled: true
```

## Variables and Environment

Define reusable values and environment-specific configuration.

### Inline Variables

```yaml
- inputText: "user@example.com"
- evalScript: ${output.email = "user@example.com"}
- assertVisible: "${output.email}"
```

### Environment Files

Create `.env` file:
```
EMAIL=test@example.com
PASSWORD=password123
API_URL=https://staging.api.example.com
```

Reference in flows:
```yaml
- inputText: "${EMAIL}"
- inputText: "${PASSWORD}"
```

Run with environment:
```bash
maestro test --env=staging flow.yaml
```

### Built-in Variables

```yaml
# Device info
- assertVisible: "${maestro.deviceModel}"
- assertTrue: "${maestro.platform == 'iOS'}"

# Random data
- inputText: "${maestro.randomEmail}"
- inputText: "${maestro.randomNumber}"

# Output from previous commands
- copyTextFrom:
    id: "confirmation_code"
- inputText: "${output.text}"
```

## Control Flow

### Conditional Execution

**runFlow** - Execute subflows conditionally:

```yaml
- runFlow:
    when:
      visible: "Login Required"
    file: login.yaml
```

Modularize common sequences (login, setup) into reusable flows.

**repeat** - Loop commands:

```yaml
- repeat:
    times: 3
    commands:
      - tapOn: "Next"
      - waitForAnimationToEnd
```

### Error Handling

**retry** - Retry commands on failure:

```yaml
- retry:
    maxAttempts: 3
    commands:
      - tapOn: "Sync"
      - assertVisible: "Sync Complete"
```

**optional** - Continue on failure:

```yaml
- tapOn:
    text: "Close Tutorial"
    optional: true
```

Use `optional` for dismissing inconsistent dialogs (permissions, tips).

## Advanced Commands

### JavaScript Evaluation

**evalScript** - Execute JavaScript:

```yaml
- evalScript: |
    var date = new Date();
    output.timestamp = date.getTime();

- inputText: "${output.timestamp}"
```

Access full JavaScript runtime for calculations, data generation.

### HTTP Requests

**httpRequest** - Make API calls:

```yaml
- httpRequest:
    url: "${API_URL}/users"
    method: GET
    headers:
      Authorization: "Bearer ${TOKEN}"
    timeout: 5000

- assertTrue: "${output.response.statusCode == 200}"
- evalScript: output.userId = json(output.response.body).id
```

Setup test data via API before UI interactions.

### Screenshots and Recording

**takeScreenshot** - Capture screen:

```yaml
- takeScreenshot: screenshots/login-success.png
```

**startRecording** / **stopRecording**:

```yaml
- startRecording: recordings/test-flow
- launchApp
# ... test steps ...
- stopRecording
```

## Best Practices

### Stability Patterns

**Wait After Actions** - Always wait after navigation:
```yaml
- tapOn: "Next Screen"
- waitForAnimationToEnd
- assertVisible: "Screen Title"
```

**Explicit Waits Over Sleeps** - Use condition-based waits:
```yaml
# Bad
- tapOn: "Load Data"
- sleep: 3000

# Good
- tapOn: "Load Data"
- extendedWaitUntil:
    visible: "Data Loaded"
    timeout: 5000
```

**Idempotent Flows** - Clear state between runs:
```yaml
- launchApp:
    clearState: true
    permissions:
      all: allow
```

### Selector Resilience

**Avoid Brittle Text** - Text changes with localization:
```yaml
# Fragile
- tapOn: "Submit"

# Resilient
- tapOn:
    id: "submit_button"
```

**Handle Dynamic Content** - Use relative selectors:
```yaml
- tapOn:
    text: "Delete"
    below:
      id: "user_${USER_ID}"
```

### Flow Organization

**Modular Subflows** - Extract reusable sequences:

`login.yaml`:
```yaml
appId: com.example.app
---
- tapOn:
    id: "email_field"
- inputText: "${EMAIL}"
- tapOn:
    id: "password_field"
- inputText: "${PASSWORD}"
- tapOn:
    id: "login_button"
- assertVisible: "Welcome"
```

Main flow:
```yaml
- runFlow: login.yaml
- tapOn: "Settings"
```

**Descriptive Comments** - Document complex interactions:
```yaml
# Dismiss onboarding if shown
- tapOn:
    text: "Skip"
    optional: true

# Wait for background sync
- extendedWaitUntil:
    visible: "Sync Complete"
    timeout: 30000
```

### Error Recovery

**Graceful Degradation** - Handle optional elements:
```yaml
# Close promotional popup if present
- tapOn:
    id: "promo_close"
    optional: true

# Proceed with main flow
- tapOn: "Dashboard"
```

**Retry Critical Paths** - Retry flaky operations:
```yaml
- retry:
    maxAttempts: 3
    commands:
      - tapOn: "Refresh"
      - waitForAnimationToEnd
      - assertVisible: "Updated Data"
```

## Performance Optimization

**Minimize Waits** - Use shortest safe timeouts:
```yaml
# Default timeout often too long
- assertVisible:
    id: "button"
    timeout: 2000  # Override default
```

**Parallel Environment Setup** - Setup via API, not UI:
```yaml
# Setup test data via API
- httpRequest:
    url: "${API_URL}/seed"
    method: POST

# Launch app with prepared state
- launchApp
```

**Reuse App State** - Skip repeated setup:
```yaml
# Keep app state between flows
- launchApp:
    clearState: false
```

## Platform Differences

### iOS Specifics

```yaml
# Clear keychain (iOS only)
- launchApp:
    clearKeychain: true

# iOS accessibility labels
- tapOn:
    accessibilityLabel: "login_button"
```

### Android Specifics

```yaml
# Android resource IDs
- tapOn:
    id: "com.example.app:id/login_button"

# Android back navigation
- back
```

## Debugging Flows

**Verbose Output** - Run with debug logging:
```bash
maestro test --debug flow.yaml
```

**Screenshot Checkpoints** - Capture state at key points:
```yaml
- takeScreenshot: debug/before-login.png
- tapOn: "Login"
- takeScreenshot: debug/after-login.png
```

**Pause for Inspection** - Add delays during development:
```yaml
- sleep: 5000  # Time to inspect app state
```

Remove sleeps before committing flows.

## Reference

For complete command syntax and advanced features, see:
- `references/commands.md` - Full command reference
- `examples/login-flow.yaml` - Login flow example
- `examples/e2e-test.yaml` - End-to-end test example

Master these patterns to create reliable, maintainable mobile test automation with Maestro.
