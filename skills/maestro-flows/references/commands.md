# Complete Maestro Command Reference

## Navigation & Lifecycle

### launchApp

Launch the application under test.

**Basic:**
```yaml
- launchApp
```

**With Options:**
```yaml
- launchApp:
    appId: com.example.app      # Override default appId
    clearState: true            # Clear app data
    clearKeychain: true         # Clear keychain (iOS only)
    stopApp: true               # Stop app first if running
    permissions:
      all: allow                # Grant all permissions
      location: allow           # Grant specific permission
      camera: deny              # Deny specific permission
    arguments:
      - "--env=staging"         # Pass launch arguments
      - "--debug"
```

**Parameters:**
- `appId` (string): Bundle ID (iOS) or package name (Android)
- `clearState` (boolean): Delete app data before launch
- `clearKeychain` (boolean): Clear keychain (iOS)
- `stopApp` (boolean): Kill app before launching
- `permissions` (object): Permission grants
- `arguments` (array): Launch arguments

### back

Press back button (Android) or navigate back (iOS).

```yaml
- back
```

### swipe

Perform swipe gesture.

**Directional:**
```yaml
- swipe:
    direction: UP               # UP, DOWN, LEFT, RIGHT
    duration: 500              # Milliseconds (default: 1500)
```

**Coordinate-based:**
```yaml
- swipe:
    start: 50%, 80%            # Start point (x%, y%)
    end: 50%, 20%              # End point
    duration: 300
```

**Parameters:**
- `direction` (string): UP, DOWN, LEFT, RIGHT
- `start` (string): Start coordinates "x%,y%"
- `end` (string): End coordinates "x%,y%"
- `duration` (number): Swipe duration in ms

### scroll

Scroll in direction.

**Simple:**
```yaml
- scroll                       # Scroll down (default)
```

**With Direction:**
```yaml
- scroll:
    direction: UP              # UP, DOWN
```

### scrollUntilVisible

Scroll until element becomes visible.

```yaml
- scrollUntilVisible:
    element:
      text: "Settings"
    direction: DOWN            # UP, DOWN
    timeout: 10000            # Milliseconds
    speed: 50                 # Scroll speed 0-100
    visibilityPercentage: 100 # Percentage visible (0-100)
```

**Parameters:**
- `element` (selector): Target element
- `direction` (string): Scroll direction
- `timeout` (number): Maximum time to scroll
- `speed` (number): Scroll speed
- `visibilityPercentage` (number): Required visibility

## Interaction

### tapOn

Tap on element or coordinates.

**By Text:**
```yaml
- tapOn: "Submit"

- tapOn:
    text: "Submit"
    index: 0                   # Select from multiple matches
```

**By ID:**
```yaml
- tapOn:
    id: "login_button"
```

**By Accessibility Label:**
```yaml
- tapOn:
    accessibilityLabel: "Login"
```

**By Coordinates:**
```yaml
- tapOn:
    point: "50%,80%"          # Percentage coordinates

- tapOn:
    point: "200,400"          # Absolute pixels
```

**Long Press:**
```yaml
- tapOn:
    id: "item"
    longPress: true
    duration: 1000            # Long press duration (ms)
```

**With Timeout:**
```yaml
- tapOn:
    text: "Button"
    timeout: 5000             # Wait up to 5s for element
```

**Relative Position:**
```yaml
- tapOn:
    text: "Delete"
    below:
      text: "John Doe"

- tapOn:
    text: "Edit"
    above:
      id: "footer"

- tapOn:
    text: "Icon"
    leftOf:
      text: "Title"

- tapOn:
    text: "Arrow"
    rightOf:
      id: "label"
```

**Wait Until:**
```yaml
- tapOn:
    id: "button"
    waitUntil:
      visible: true           # Wait until visible
      notVisible: false       # Wait until not visible
```

**Parameters:**
- `text` (string): Visible text content
- `id` (string): Resource ID
- `accessibilityLabel` (string): Accessibility label
- `point` (string): Coordinates
- `index` (number): Index for multiple matches
- `longPress` (boolean): Long press gesture
- `duration` (number): Long press duration
- `timeout` (number): Wait timeout
- `optional` (boolean): Don't fail if not found
- `enabled` (boolean): Filter by enabled state
- `below/above/leftOf/rightOf` (selector): Relative positioning

### doubleTapOn

Double-tap on element.

```yaml
- doubleTapOn:
    id: "image"
```

Same parameters as `tapOn`.

### inputText

Input text into focused element.

**Simple:**
```yaml
- inputText: "Hello World"
```

**With Special Keys:**
```yaml
- inputText: "password123\n"  # \n = Enter key
```

**With Variables:**
```yaml
- inputText: "${EMAIL}"
```

**Parameters:**
- Text string to input

### eraseText

Clear text from input field.

**Clear All:**
```yaml
- eraseText
```

**Clear N Characters:**
```yaml
- eraseText:
    charactersToErase: 10
```

**Parameters:**
- `charactersToErase` (number): Number of characters to delete

## Assertions

### assertVisible

Assert element is visible.

**Simple:**
```yaml
- assertVisible: "Success Message"
```

**With Selector:**
```yaml
- assertVisible:
    id: "success_icon"
    timeout: 5000
```

**Parameters:**
- Element selector
- `timeout` (number): Wait timeout

### assertNotVisible

Assert element is not visible.

```yaml
- assertNotVisible:
    text: "Error Message"
```

### assertTrue

Assert condition is true.

**Simple:**
```yaml
- assertTrue: ${USER_LOGGED_IN}
```

**With Condition:**
```yaml
- assertTrue:
    condition: "${STATUS_CODE} == 200"
    timeout: 3000
```

**Parameters:**
- `condition` (string): JavaScript expression
- `timeout` (number): Wait timeout

### assertFalse

Assert condition is false.

```yaml
- assertFalse:
    condition: "${HAS_ERROR}"
```

## Waiting

### waitForAnimationToEnd

Wait for UI animations to complete.

```yaml
- waitForAnimationToEnd:
    timeout: 3000             # Default: 15000ms
```

### extendedWaitUntil

Wait for complex conditions.

**Wait for Visible:**
```yaml
- extendedWaitUntil:
    visible: "Loading Complete"
    timeout: 30000
```

**Wait for Not Visible:**
```yaml
- extendedWaitUntil:
    notVisible:
      id: "loading_spinner"
    timeout: 10000
```

**Parameters:**
- `visible` (selector): Element to wait for
- `notVisible` (selector): Element to wait to disappear
- `timeout` (number): Maximum wait time

### sleep

Wait for fixed duration (avoid if possible).

```yaml
- sleep: 3000                 # Milliseconds
```

## Control Flow

### runFlow

Execute another flow file.

**Simple:**
```yaml
- runFlow: login.yaml
```

**With Environment:**
```yaml
- runFlow:
    file: checkout.yaml
    env:
      PRODUCT_ID: "12345"
      QUANTITY: "2"
```

**Conditional:**
```yaml
- runFlow:
    when:
      visible: "Login Required"
    file: login.yaml
```

**Parameters:**
- `file` (string): Path to flow file
- `env` (object): Environment variables
- `when` (condition): Conditional execution

### repeat

Repeat commands multiple times.

```yaml
- repeat:
    times: 3
    commands:
      - tapOn: "Next"
      - waitForAnimationToEnd
```

**While Condition:**
```yaml
- repeat:
    while:
      notVisible: "End of List"
    commands:
      - scroll
```

**Parameters:**
- `times` (number): Repeat count
- `while` (condition): Repeat while condition true
- `commands` (array): Commands to repeat

### retry

Retry commands on failure.

```yaml
- retry:
    maxAttempts: 3
    commands:
      - tapOn: "Sync"
      - assertVisible: "Sync Complete"
```

**Parameters:**
- `maxAttempts` (number): Maximum retry attempts
- `commands` (array): Commands to retry

## Data & Scripting

### evalScript

Execute JavaScript code.

```yaml
- evalScript: |
    var timestamp = Date.now();
    output.timestamp = timestamp;
    output.email = "user" + timestamp + "@example.com";
```

**Built-in Functions:**
- `output` - Store values for later use
- `random()` - Random number 0-1
- `randomInt(min, max)` - Random integer
- `randomEmail()` - Random email address

**Access Variables:**
```yaml
- evalScript: |
    var savedEmail = "${output.email}";
    console.log("Email: " + savedEmail);
```

### copyTextFrom

Copy text from element to output.

```yaml
- copyTextFrom:
    id: "confirmation_code"

# Use copied text
- inputText: "${output.text}"
```

**Parameters:**
- Element selector

### pasteText

Paste from clipboard.

```yaml
- pasteText
```

## HTTP Requests

### httpRequest

Make HTTP requests.

**GET Request:**
```yaml
- httpRequest:
    url: "${API_URL}/users"
    method: GET
    headers:
      Authorization: "Bearer ${TOKEN}"
    timeout: 5000
```

**POST Request:**
```yaml
- httpRequest:
    url: "${API_URL}/users"
    method: POST
    headers:
      Content-Type: "application/json"
    body: |
      {
        "name": "John Doe",
        "email": "john@example.com"
      }
```

**Response Access:**
```yaml
- httpRequest:
    url: "${API_URL}/status"
    method: GET

- assertTrue: "${output.response.statusCode == 200}"
- evalScript: |
    var data = JSON.parse(output.response.body);
    output.userId = data.id;
```

**Parameters:**
- `url` (string): Request URL
- `method` (string): HTTP method
- `headers` (object): Request headers
- `body` (string): Request body
- `timeout` (number): Request timeout

**Response Object:**
- `output.response.statusCode` - HTTP status code
- `output.response.body` - Response body
- `output.response.headers` - Response headers

## Media

### takeScreenshot

Capture screenshot.

```yaml
- takeScreenshot: screenshots/test-result.png
```

**Parameters:**
- Path to save screenshot

### startRecording

Start screen recording.

```yaml
- startRecording: recordings/test-flow
```

### stopRecording

Stop screen recording.

```yaml
- stopRecording
```

## Device Actions

### pressKey

Press device keys.

```yaml
- pressKey: Home
- pressKey: Back
- pressKey: Enter
- pressKey: VolumeUp
- pressKey: VolumeDown
```

**Available Keys:**
- Home, Back, Enter
- VolumeUp, VolumeDown
- Power, Menu

### hideKeyboard

Dismiss on-screen keyboard.

```yaml
- hideKeyboard
```

### openLink

Open URL (browser or deep link).

```yaml
- openLink: https://example.com

- openLink: myapp://profile/123
```

## Advanced Selectors

### Contains Text

```yaml
- tapOn:
    text_contains: "Submit"   # Partial match
```

### Regex Match

```yaml
- assertVisible:
    text_regex: "Order #\\d+"
```

### Size Constraints

```yaml
- tapOn:
    text: "Button"
    width: ">100"             # Width > 100px
    height: "<200"            # Height < 200px
```

### Multiple Conditions

```yaml
- tapOn:
    text: "Submit"
    enabled: true
    below:
      text: "Form Title"
    above:
      id: "footer"
```

## Platform-Specific

### iOS Only

**Clear Keychain:**
```yaml
- launchApp:
    clearKeychain: true
```

**Accessibility Inspector:**
```yaml
- tapOn:
    accessibilityLabel: "login_button"
    accessibilityHint: "Double tap to login"
```

### Android Only

**Full Resource ID:**
```yaml
- tapOn:
    id: "com.example.app:id/login_button"
```

**Content Description:**
```yaml
- tapOn:
    contentDescription: "Login Button"
```

## Environment Variables

**Built-in Variables:**
- `${maestro.platform}` - "iOS" or "Android"
- `${maestro.deviceModel}` - Device model name
- `${maestro.locale}` - Device locale
- `${maestro.randomEmail}` - Random email
- `${maestro.randomNumber}` - Random number
- `${output.text}` - Copied text
- `${output.*}` - Script output variables

**Custom Variables:**
Set in `.env` file or `--env` parameter:
```
EMAIL=test@example.com
PASSWORD=secret123
API_URL=https://api.example.com
```

Use in flows:
```yaml
- inputText: "${EMAIL}"
- inputText: "${PASSWORD}"
```

## Special Characters

**Input Special Keys:**
- `\n` - Enter/Return key
- `\t` - Tab key
- `\b` - Backspace

```yaml
- inputText: "search query\n"  # Type and submit
```

## Conditional Execution

**Run When Visible:**
```yaml
- runFlow:
    when:
      visible: "Tutorial Screen"
    file: skip-tutorial.yaml
```

**Run When Not Visible:**
```yaml
- runFlow:
    when:
      notVisible: "Logged In"
    file: login.yaml
```

**Platform Conditional:**
```yaml
- runFlow:
    when:
      platform: iOS
    file: ios-specific.yaml
```

## Error Handling

**Optional Commands:**
```yaml
- tapOn:
    text: "Close"
    optional: true            # Don't fail if not found
```

**Retry on Failure:**
```yaml
- retry:
    maxAttempts: 3
    commands:
      - tapOn: "Refresh"
      - assertVisible: "Updated"
```

**Custom Error Messages:**
```yaml
- assertTrue:
    condition: "${STATUS} == 'success'"
    label: "API request should succeed"
```

## Performance

**Timeouts:**
Most commands accept `timeout` parameter (milliseconds):
```yaml
- assertVisible:
    id: "element"
    timeout: 5000             # Wait up to 5 seconds
```

**Default Timeouts:**
- `tapOn`: 30s
- `assertVisible`: 30s
- `extendedWaitUntil`: 60s

**Override Defaults:**
```yaml
- tapOn:
    id: "button"
    timeout: 2000             # Shorter timeout
```
