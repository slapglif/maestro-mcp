# Mobile Testing Strategy and Best Practices

Use when designing mobile test strategies, debugging flaky tests, setting up mobile CI/CD, or understanding iOS/Android testing patterns.

## Mobile Testing Fundamentals

Mobile testing differs fundamentally from web testing. Apps run on diverse devices with varying screen sizes, operating system versions, hardware capabilities, and network conditions. Design tests to handle this variability while maintaining reliability.

### The Mobile Testing Pyramid

Structure mobile test suites following the testing pyramid principle:

**Unit Tests (70%)** - Fast, isolated tests of individual components. Run on developer machines and CI. No device required.

**Integration Tests (20%)** - Test component interactions, API integrations, data persistence. May use simulators/emulators.

**UI Tests (10%)** - Full application flows on real devices or simulators. Slowest, most expensive, highest maintenance. Reserve for critical user journeys.

Maestro targets the UI layer. Complement with unit and integration tests for comprehensive coverage.

## iOS vs Android Testing

Platform differences impact test design, tooling, and debugging approaches.

### Element Identification

**iOS:**
```yaml
# Accessibility labels (preferred)
- tapOn:
    accessibilityLabel: "login_button"

# Accessibility identifiers (most stable)
- tapOn:
    id: "loginButton"
```

iOS accessibility identifiers are stable, hidden from users. Always set `accessibilityIdentifier` on interactive elements in development.

**Android:**
```yaml
# Resource IDs (preferred)
- tapOn:
    id: "com.example.app:id/login_button"

# Content descriptions
- tapOn:
    contentDescription: "Login button"
```

Android resource IDs include package prefix. Content descriptions are accessibility features, may be localized.

### Navigation Patterns

**iOS:**
```yaml
# Back navigation (swipe or nav bar)
- swipe:
    direction: RIGHT

# Or use back button if present
- tapOn:
    text: "< Back"
```

**Android:**
```yaml
# Hardware back button
- back

# Or gesture navigation
- swipe:
    start: "0%,50%"
    end: "100%,50%"
```

Test both navigation methods on Android (hardware back, gesture, UI back button) as they may trigger different behaviors.

### Permission Handling

**iOS:**
Grant permissions at launch:
```yaml
- launchApp:
    permissions:
      all: allow
      # Or specific:
      location: allow
      camera: allow
      photos: deny
```

**Android:**
Runtime permissions often require UI interaction:
```yaml
- launchApp
- tapOn: "Enable Location"
# Permission dialog appears
- tapOn:
    text: "Allow"
    optional: true  # May already be granted
```

Always grant permissions in setup to avoid mid-test interruptions.

## Test Environment Setup

Reliable tests require consistent, repeatable environments.

### Simulator/Emulator Configuration

**iOS Simulators:**
```bash
# List available simulators
xcrun simctl list devices

# Create specific simulator
xcrun simctl create "Test iPhone 14" \
  com.apple.CoreSimulator.SimDeviceType.iPhone-14 \
  com.apple.CoreSimulator.SimRuntime.iOS-16-0

# Boot simulator
xcrun simctl boot "Test iPhone 14"
```

Pin simulator OS versions in CI. Don't use "latest" - iOS updates can break tests.

**Android Emulators:**
```bash
# List AVDs
emulator -list-avds

# Create AVD
avdmanager create avd \
  -n "Test_Pixel_6" \
  -k "system-images;android-33;google_apis;x86_64" \
  -d "pixel_6"

# Launch emulator
emulator -avd Test_Pixel_6 -no-snapshot-load
```

Use Google APIs system images for Play Services support. Disable snapshots (`-no-snapshot-load`) for clean state.

### Clean State Management

Every test should start from known state:

```yaml
- launchApp:
    clearState: true        # Delete app data
    clearKeychain: true     # Clear credentials (iOS)
    stopApp: true          # Kill app if running
```

For faster tests, setup state via API instead of UI:

```yaml
# Setup test data
- httpRequest:
    url: "${API_URL}/test/seed"
    method: POST
    body: |
      {
        "userId": "${TEST_USER_ID}",
        "state": "logged_in"
      }

# Launch with prepared state
- launchApp:
    clearState: false
```

## Debugging Flaky Tests

Flaky tests fail intermittently without code changes. Root causes: timing issues, test interdependence, environment variability.

### Common Causes and Solutions

**1. Race Conditions**

**Problem:** Tapping elements before they're interactive.

```yaml
# Flaky
- tapOn: "Submit"
- assertVisible: "Success"
```

**Solution:** Wait for animations, async operations:

```yaml
# Stable
- tapOn: "Submit"
- waitForAnimationToEnd
- extendedWaitUntil:
    visible: "Success"
    timeout: 5000
```

Always wait after navigation, transitions, network requests.

**2. Element Timing**

**Problem:** Element exists but not yet visible/enabled.

```yaml
# Flaky - immediate tap
- tapOn:
    id: "button"
```

**Solution:** Explicit wait with timeout:

```yaml
# Stable - wait for element
- tapOn:
    id: "button"
    timeout: 5000
```

**3. Dynamic Content**

**Problem:** Content loads asynchronously, timing varies.

```yaml
# Flaky - assumes instant load
- launchApp
- assertVisible: "Dashboard Data"
```

**Solution:** Wait for loading completion:

```yaml
# Stable - explicit wait
- launchApp
- extendedWaitUntil:
    notVisible: "Loading..."
    timeout: 10000
- assertVisible: "Dashboard Data"
```

**4. Test Interdependence**

**Problem:** Test relies on state from previous test.

```yaml
# Test 1 creates user
# Test 2 assumes user exists  # FLAKY
```

**Solution:** Each test creates own state:

```yaml
# Test 2 - self-contained
- httpRequest:
    url: "${API_URL}/test/seed"
    # Create test user
```

Never depend on test execution order. Tests should pass individually and in any order.

**5. Hardcoded Waits**

**Problem:** `sleep` times are guesses, fail under load.

```yaml
# Flaky - arbitrary delay
- tapOn: "Refresh"
- sleep: 3000
- assertVisible: "Updated"
```

**Solution:** Condition-based waits:

```yaml
# Stable - wait for condition
- tapOn: "Refresh"
- extendedWaitUntil:
    visible: "Updated"
    timeout: 10000
```

### Debugging Process

**1. Reproduce Locally**

Run test repeatedly until failure:
```bash
for i in {1..50}; do
  maestro test flow.yaml || break
done
```

**2. Add Debug Logging**

Insert screenshots, logging:
```yaml
- takeScreenshot: debug/before-action.png
- tapOn: "Button"
- takeScreenshot: debug/after-action.png
```

**3. Isolate Steps**

Comment out steps to find flaky command:
```yaml
# - tapOn: "Step 1"  # Works
# - tapOn: "Step 2"  # Works
- tapOn: "Step 3"     # FLAKY
```

**4. Check Timing**

Add generous timeout to suspected command:
```yaml
- tapOn:
    id: "button"
    timeout: 30000  # If this fixes it, timing issue
```

**5. Verify Selectors**

Check element actually exists with expected selector:
```bash
maestro test --debug flow.yaml
# Examine element tree in logs
```

## CI/CD Integration

Automate test execution in continuous integration pipelines.

### GitHub Actions Setup

**Workflow File** (`.github/workflows/mobile-tests.yml`):

```yaml
name: Mobile Tests

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  ios-tests:
    runs-on: macos-13
    steps:
      - uses: actions/checkout@v3

      - name: Setup Maestro
        run: |
          curl -Ls "https://get.maestro.mobile.dev" | bash
          echo "$HOME/.maestro/bin" >> $GITHUB_PATH

      - name: Setup iOS Simulator
        run: |
          xcrun simctl boot "iPhone 14"
          xcrun simctl bootstatus "iPhone 14"

      - name: Build App
        run: |
          cd ios
          xcodebuild -workspace App.xcworkspace \
            -scheme App \
            -configuration Debug \
            -sdk iphonesimulator \
            -derivedDataPath build

      - name: Install App
        run: |
          xcrun simctl install booted \
            ios/build/Build/Products/Debug-iphonesimulator/App.app

      - name: Run Tests
        env:
          EMAIL: ${{ secrets.TEST_EMAIL }}
          PASSWORD: ${{ secrets.TEST_PASSWORD }}
          API_URL: https://staging-api.example.com
        run: |
          maestro test flows/ --format junit --output results.xml

      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results-ios
          path: |
            results.xml
            ~/.maestro/tests/**/screenshots/

  android-tests:
    runs-on: macos-13
    steps:
      - uses: actions/checkout@v3

      - name: Setup Maestro
        run: |
          curl -Ls "https://get.maestro.mobile.dev" | bash
          echo "$HOME/.maestro/bin" >> $GITHUB_PATH

      - name: Setup Android Emulator
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 33
          target: google_apis
          arch: x86_64
          profile: pixel_6
          script: echo "Emulator started"

      - name: Build APK
        run: |
          cd android
          ./gradlew assembleDebug

      - name: Run Tests
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 33
          target: google_apis
          arch: x86_64
          profile: pixel_6
          script: maestro test flows/ --format junit --output results.xml

      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results-android
          path: |
            results.xml
            ~/.maestro/tests/**/screenshots/
```

**Key Points:**
- Use macOS runners (required for iOS simulators)
- Install Maestro via official script
- Boot simulator/emulator before tests
- Store credentials in GitHub Secrets
- Upload test artifacts (screenshots, videos, results)

### Optimization Strategies

**Parallel Execution:**

Split tests across jobs:
```yaml
strategy:
  matrix:
    test-suite: [auth, checkout, settings]

steps:
  - name: Run Tests
    run: maestro test flows/${{ matrix.test-suite }}/
```

**Caching:**

Cache dependencies, build artifacts:
```yaml
- name: Cache Pods
  uses: actions/cache@v3
  with:
    path: ios/Pods
    key: pods-${{ hashFiles('ios/Podfile.lock') }}

- name: Cache Gradle
  uses: actions/cache@v3
  with:
    path: |
      ~/.gradle/caches
      ~/.gradle/wrapper
    key: gradle-${{ hashFiles('android/**/*.gradle*') }}
```

## Test Design Patterns

### Page Object Pattern

Encapsulate screen interactions in reusable flows.

**login-screen.yaml** (Page Object):
```yaml
# Login screen interactions
appId: com.example.app
---
# Fill email
- tapOn:
    id: "email_input"
- inputText: "${EMAIL}"

# Fill password
- tapOn:
    id: "password_input"
- inputText: "${PASSWORD}"

# Submit
- tapOn:
    id: "login_button"

# Wait for completion
- waitForAnimationToEnd
```

**Main test** uses page objects:
```yaml
appId: com.example.app
---
- launchApp
- runFlow: screens/login-screen.yaml
- assertVisible: "Dashboard"
```

Benefits: DRY principle, easier maintenance, clear test structure.

### Data-Driven Testing

Run same test with multiple datasets.

**Create environment files:**

`users/admin.env`:
```
EMAIL=admin@example.com
PASSWORD=admin123
EXPECTED_ROLE=Administrator
```

`users/user.env`:
```
EMAIL=user@example.com
PASSWORD=user123
EXPECTED_ROLE=User
```

**Single test flow:**
```yaml
appId: com.example.app
---
- runFlow: login-screen.yaml
- assertVisible: "${EXPECTED_ROLE}"
```

**Run with different data:**
```bash
maestro test --env=users/admin.env test.yaml
maestro test --env=users/user.yaml test.yaml
```

### Setup and Teardown

**setup-flow.yaml** (runs before tests):
```yaml
appId: com.example.app
---
# Seed database
- httpRequest:
    url: "${API_URL}/test/seed"
    method: POST

# Grant permissions
- launchApp:
    permissions:
      all: allow
```

**teardown-flow.yaml** (runs after tests):
```yaml
appId: com.example.app
---
# Cleanup test data
- httpRequest:
    url: "${API_URL}/test/cleanup"
    method: POST
```

## Handling Async Content

Mobile apps heavily use asynchronous operations: network requests, animations, background tasks.

### Network Requests

**Pattern:** Wait for loading indicators to disappear:

```yaml
- tapOn: "Refresh"

# Wait for loading to start (optional but robust)
- assertVisible:
    id: "loading_spinner"
    timeout: 1000

# Wait for loading to finish
- extendedWaitUntil:
    notVisible:
      id: "loading_spinner"
    timeout: 30000

# Now assert content loaded
- assertVisible: "Updated Data"
```

### Animations and Transitions

**Pattern:** Wait for animations after navigation:

```yaml
- tapOn: "Next Screen"
- waitForAnimationToEnd:
    timeout: 3000

# Screen ready for interaction
- assertVisible: "Screen Title"
```

### Progressive Loading

**Pattern:** Wait for critical content, not all content:

```yaml
- tapOn: "Dashboard"

# Wait for essential UI
- assertVisible: "Dashboard Title"

# Don't wait for slow-loading widget
- assertVisible:
    id: "news_widget"
    optional: true
```

### Retry Patterns

**Pattern:** Retry unreliable operations:

```yaml
- retry:
    maxAttempts: 3
    commands:
      - tapOn: "Sync"
      - extendedWaitUntil:
          visible: "Sync Complete"
          timeout: 10000
```

## Test Maintenance

Mobile apps evolve rapidly. Design tests for maintainability.

### Selector Strategy

**Priority:**
1. Stable IDs (best)
2. Accessibility labels
3. Semantic selectors (role, type)
4. Text content (fragile)
5. Coordinates (avoid)

**Example refactor:**

```yaml
# Before (fragile)
- tapOn: "Submit"  # Changes with localization

# After (stable)
- tapOn:
    id: "submit_button"  # Set in code, never changes
```

### Shared Flows

Extract common sequences:

```yaml
# flows/common/login.yaml
# flows/common/logout.yaml
# flows/common/dismiss-tutorial.yaml
```

Update once, all tests benefit.

### Environment Abstraction

Never hardcode environment-specific values:

```yaml
# Bad
- httpRequest:
    url: "https://staging-api.example.com/users"

# Good
- httpRequest:
    url: "${API_URL}/users"
```

Configure per environment:
- `.env.staging`
- `.env.production`

## Platform-Specific Considerations

### iOS Specifics

**Keychain Persistence:**
```yaml
# Clear keychain between tests
- launchApp:
    clearKeychain: true
```

**Simulator Differences:**
- No Face ID (use passcode simulation)
- No camera (use photo library)
- Different performance characteristics

**Accessibility Inspector:**
Use Xcode's Accessibility Inspector to find element identifiers:
1. Open Xcode
2. Xcode > Open Developer Tool > Accessibility Inspector
3. Select simulator
4. Inspect elements for `accessibilityIdentifier`

### Android Specifics

**Package-Scoped IDs:**
```yaml
# Full resource ID
- tapOn:
    id: "com.example.app:id/button"
```

**Hardware Buttons:**
```yaml
- pressKey: Back
- pressKey: Home
- pressKey: VolumeUp
```

**Screen Orientations:**
```yaml
- tapOn: "Rotate Test"
# Handle landscape mode
```

**Emulator Quirks:**
- First boot slow (use `-no-snapshot-load`)
- Animation settings affect test speed
- Network simulation via emulator controls

## Performance Testing

Measure app performance during test execution.

**Launch Time:**
```yaml
- evalScript: output.launchStart = Date.now()
- launchApp
- assertVisible: "Home Screen"
- evalScript: |
    output.launchTime = Date.now() - output.launchStart;
    console.log("Launch time: " + output.launchTime + "ms");
```

**Action Response:**
```yaml
- evalScript: output.actionStart = Date.now()
- tapOn: "Load Data"
- extendedWaitUntil:
    visible: "Data Loaded"
- evalScript: |
    output.actionTime = Date.now() - output.actionStart;
    console.log("Action time: " + output.actionTime + "ms");
```

## Accessibility Testing

Maestro flows inherently test accessibility by using accessibility identifiers and labels. Enhance coverage:

**Verify Labels:**
```yaml
- assertVisible:
    accessibilityLabel: "Submit login form"
```

**Test VoiceOver/TalkBack Navigation:**
```yaml
# Ensure critical elements have labels
- tapOn:
    accessibilityLabel: "Next"
- assertVisible:
    accessibilityLabel: "Step 2 of 3"
```

## Security Testing

**Secure Credential Handling:**

```yaml
# Never commit credentials
- inputText: "${PASSWORD}"  # From environment

# Clear sensitive data
- launchApp:
    clearKeychain: true  # iOS
    clearState: true     # Both platforms
```

**Test Permission Boundaries:**
```yaml
# Verify app handles denied permissions
- launchApp:
    permissions:
      location: deny

- tapOn: "Enable Location"
- assertVisible: "Location permission required"
```

## Reference

For detailed debugging techniques and CI setup:
- `references/debugging.md` - Complete debugging guide
- `references/ci-setup.md` - CI/CD configuration examples

Apply these patterns to build reliable, maintainable mobile test suites with Maestro.
