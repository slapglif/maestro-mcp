# Maestro Debugging Guide

Complete guide to diagnosing and fixing Maestro test issues.

## Quick Diagnostics

### Run with Debug Output

```bash
maestro test --debug flow.yaml
```

Shows:
- Element hierarchy at each step
- Command execution timing
- Selector matching details
- Screenshots at failure points

### Visual Debugging

```bash
maestro studio
```

Interactive UI for:
- Exploring element tree
- Testing selectors live
- Recording flows
- Inspecting app state

## Common Issues

### 1. Element Not Found

**Symptom:**
```
Error: Could not find element matching: {id: "button"}
```

**Diagnosis:**

Run with debug to see element tree:
```bash
maestro test --debug flow.yaml
```

Check output for available elements:
```
Available elements:
  - id: "login_button" (not "button")
  - text: "Submit"
  - accessibilityLabel: "submit_btn"
```

**Solutions:**

**A. Wrong Selector**
```yaml
# Wrong
- tapOn:
    id: "button"

# Correct (from debug output)
- tapOn:
    id: "login_button"
```

**B. Element Not Yet Visible**
```yaml
# Add timeout
- tapOn:
    id: "button"
    timeout: 5000
```

**C. Element Behind Animation**
```yaml
# Wait for animation
- waitForAnimationToEnd
- tapOn:
    id: "button"
```

**D. Element on Different Screen**
```yaml
# Navigate first
- tapOn: "Next"
- waitForAnimationToEnd
- tapOn:
    id: "button"
```

### 2. Element Not Interactable

**Symptom:**
```
Error: Element not visible or enabled
```

**Diagnosis:**

Element exists but cannot be interacted with:
- Behind modal/overlay
- Disabled state
- Off-screen
- Transparent/zero-sized

**Solutions:**

**A. Dismiss Overlay**
```yaml
# Close blocking modal
- tapOn:
    id: "modal_close"
    optional: true

# Now interact with element
- tapOn:
    id: "button"
```

**B. Wait for Enabled State**
```yaml
- extendedWaitUntil:
    visible:
      id: "submit_button"
      enabled: true
```

**C. Scroll Into View**
```yaml
- scrollUntilVisible:
    element:
      id: "button"
```

**D. Check Element Visibility**
```yaml
# Debug: take screenshot
- takeScreenshot: debug/element-location.png

# Verify element properties
- assertVisible:
    id: "button"
    enabled: true
```

### 3. Flaky Tests (Intermittent Failures)

**Symptom:**
Test passes sometimes, fails others without code changes.

**Common Causes:**

**A. Race Condition**

```yaml
# Flaky - doesn't wait
- tapOn: "Load"
- assertVisible: "Data"

# Fixed - explicit wait
- tapOn: "Load"
- extendedWaitUntil:
    visible: "Data"
    timeout: 10000
```

**B. Hardcoded Sleep**

```yaml
# Flaky - arbitrary timing
- tapOn: "Refresh"
- sleep: 2000
- assertVisible: "Updated"

# Fixed - condition-based
- tapOn: "Refresh"
- extendedWaitUntil:
    notVisible: "Loading"
    timeout: 5000
- assertVisible: "Updated"
```

**C. Test Interdependence**

```yaml
# Flaky - depends on previous test
- assertVisible: "User Profile"

# Fixed - self-contained setup
- httpRequest:
    url: "${API_URL}/test/seed"
- launchApp
- assertVisible: "User Profile"
```

**D. Animation Timing**

```yaml
# Flaky - interaction during animation
- tapOn: "Next"
- tapOn: "Submit"

# Fixed - wait for animation
- tapOn: "Next"
- waitForAnimationToEnd
- tapOn: "Submit"
```

**Debugging Flaky Tests:**

1. **Reproduce locally:**
```bash
# Run 50 times until failure
for i in {1..50}; do
  echo "Run $i"
  maestro test flow.yaml || break
done
```

2. **Add diagnostic screenshots:**
```yaml
- takeScreenshot: debug/step-1.png
- tapOn: "Action"
- takeScreenshot: debug/step-2.png
```

3. **Increase timeouts temporarily:**
```yaml
# If this fixes it, timing issue
- tapOn:
    id: "button"
    timeout: 30000
```

4. **Isolate flaky step:**
```yaml
# Comment out steps to find culprit
# - step1  # Works
# - step2  # Works
- step3    # FLAKY
```

### 4. Wrong Element Selected

**Symptom:**
Maestro taps wrong element when multiple match selector.

**Diagnosis:**

```bash
maestro test --debug flow.yaml
```

Output shows:
```
Found 3 elements matching {text: "Delete"}
Using index: 0
```

**Solutions:**

**A. Use Unique Selector**
```yaml
# Ambiguous
- tapOn: "Delete"

# Specific
- tapOn:
    id: "delete_user_123"
```

**B. Use Index**
```yaml
# Second "Delete" button
- tapOn:
    text: "Delete"
    index: 1
```

**C. Use Relative Position**
```yaml
# Delete button below specific user
- tapOn:
    text: "Delete"
    below:
      text: "John Doe"
```

**D. Use Additional Constraints**
```yaml
# Enabled delete button only
- tapOn:
    text: "Delete"
    enabled: true
```

### 5. Platform-Specific Failures

**Symptom:**
Test passes on iOS, fails on Android (or vice versa).

**Common Causes:**

**A. Different Element Identifiers**

```yaml
# iOS uses accessibilityLabel
- tapOn:
    accessibilityLabel: "submit"

# Android uses contentDescription
- tapOn:
    contentDescription: "submit"
```

**Solution - Platform Conditional:**
```yaml
- runFlow:
    when:
      platform: iOS
    file: ios-submit.yaml

- runFlow:
    when:
      platform: Android
    file: android-submit.yaml
```

**B. Navigation Differences**

```yaml
# iOS: swipe back
- swipe:
    direction: RIGHT

# Android: back button
- back
```

**Solution - Unified Flow:**
```yaml
# Try both methods
- back
  optional: true

- swipe:
    direction: RIGHT
    optional: true
```

**C. Permission Handling**

```yaml
# iOS: grant at launch
- launchApp:
    permissions:
      all: allow

# Android: may need runtime grant
- tapOn:
    text: "Allow"
    optional: true
```

### 6. App Crashes

**Symptom:**
App terminates during test execution.

**Diagnosis:**

Check device/simulator logs:

**iOS:**
```bash
# Real device
idevicesyslog

# Simulator
xcrun simctl spawn booted log stream --level debug
```

**Android:**
```bash
adb logcat
```

**Solutions:**

**A. App Bug - Report to Developers**

Crash logs show app issue:
```
Fatal Exception: java.lang.NullPointerException
```

**B. Out of Memory**

```yaml
# Restart app periodically
- repeat:
    times: 5
    commands:
      - runFlow: test-case.yaml
      - launchApp:
          clearState: true
```

**C. Test Triggering Edge Case**

Modify test to avoid crash:
```yaml
# Skip problematic interaction
- tapOn:
    id: "crash_trigger"
    optional: true
```

### 7. Timeout Errors

**Symptom:**
```
Error: Timeout waiting for element
```

**Diagnosis:**

Element never appears within timeout period.

**Solutions:**

**A. Increase Timeout**
```yaml
# Slow network/operation
- assertVisible:
    id: "data"
    timeout: 30000  # 30 seconds
```

**B. Check Element Actually Appears**
```yaml
# Add screenshot to verify
- takeScreenshot: debug/before-assert.png
- assertVisible: "Element"
```

**C. Wrong Selector**
```yaml
# Verify with debug mode
maestro test --debug flow.yaml
# Check if element exists with different selector
```

**D. App State Issue**

```yaml
# Reset app state
- launchApp:
    clearState: true
```

### 8. Network-Related Failures

**Symptom:**
Tests fail due to slow/failed API requests.

**Solutions:**

**A. Mock Network Responses**

```yaml
# Setup mock server
- httpRequest:
    url: "${MOCK_SERVER}/setup"
    method: POST
    body: |
      {
        "endpoint": "/api/users",
        "response": {"id": 123}
      }
```

**B. Seed Data via API**

```yaml
# Avoid slow UI data entry
- httpRequest:
    url: "${API_URL}/test/seed"
    method: POST
```

**C. Wait for Network Completion**

```yaml
- tapOn: "Refresh"
- extendedWaitUntil:
    notVisible: "Loading"
    timeout: 30000
```

### 9. Input Text Issues

**Symptom:**
```
Error: Could not input text
```

**Diagnosis:**

Input field not focused or keyboard issues.

**Solutions:**

**A. Focus Field First**
```yaml
# Tap field before typing
- tapOn:
    id: "email_input"
- inputText: "user@example.com"
```

**B. Clear Existing Text**
```yaml
- tapOn:
    id: "input"
- eraseText
- inputText: "new text"
```

**C. Hide Keyboard Between Fields**
```yaml
- tapOn:
    id: "field1"
- inputText: "text1"
- hideKeyboard

- tapOn:
    id: "field2"
- inputText: "text2"
```

**D. Use Special Keys**
```yaml
# Submit form with Enter
- inputText: "search query\n"
```

### 10. Screenshot/Recording Failures

**Symptom:**
```
Error: Could not save screenshot
```

**Solutions:**

**A. Create Output Directory**
```bash
mkdir -p screenshots
```

**B. Use Relative Paths**
```yaml
# Good
- takeScreenshot: screenshots/test.png

# Bad (absolute paths may fail)
- takeScreenshot: /tmp/test.png
```

**C. Check Permissions**
```bash
chmod -R 755 screenshots/
```

## Advanced Debugging

### Interactive Debugging

**Maestro Studio:**
```bash
maestro studio
```

Features:
- Visual element inspector
- Live selector testing
- Flow recording
- Real-time app interaction

**Workflow:**
1. Launch Studio
2. Connect device/simulator
3. Inspect element tree
4. Test selectors
5. Copy working selectors to flow

### Element Hierarchy Analysis

**Debug output shows tree structure:**
```
View (id: "container")
  ├─ Button (id: "submit", text: "Submit")
  ├─ TextField (id: "input")
  └─ View (id: "footer")
      └─ Text (text: "Version 1.0")
```

Use hierarchy for relative selectors:
```yaml
# Target specific submit button
- tapOn:
    id: "submit"
    below:
      id: "container"
```

### Performance Debugging

**Measure command execution time:**

```bash
time maestro test flow.yaml
```

**Profile slow steps:**

```yaml
- evalScript: console.log("Starting slow operation: " + Date.now())
- tapOn: "Heavy Operation"
- evalScript: console.log("Completed: " + Date.now())
```

### State Inspection

**Capture app state at key points:**

```yaml
# Before action
- takeScreenshot: state/before.png
- evalScript: |
    console.log("State before:");
    console.log(JSON.stringify(output));

# Action
- tapOn: "Action"

# After action
- takeScreenshot: state/after.png
- evalScript: |
    console.log("State after:");
    console.log(JSON.stringify(output));
```

## Environment-Specific Debugging

### Simulator/Emulator Issues

**iOS Simulator:**

Reset simulator:
```bash
xcrun simctl erase all
```

Check simulator status:
```bash
xcrun simctl list devices | grep Booted
```

Reinstall app:
```bash
xcrun simctl uninstall booted com.example.app
xcrun simctl install booted path/to/App.app
```

**Android Emulator:**

Wipe emulator data:
```bash
emulator -avd Pixel_6 -wipe-data
```

Check emulator status:
```bash
adb devices
```

Reinstall app:
```bash
adb uninstall com.example.app
adb install app.apk
```

### Real Device Issues

**iOS:**

Check device connection:
```bash
idevice_id -l
```

View device logs:
```bash
idevicesyslog | grep "com.example.app"
```

**Android:**

Check device connection:
```bash
adb devices
```

View device logs:
```bash
adb logcat | grep "com.example.app"
```

## CI/CD Debugging

### GitHub Actions Issues

**View detailed logs:**
```yaml
- name: Run Tests
  run: maestro test --debug flow.yaml
```

**Upload debug artifacts:**
```yaml
- name: Upload Debug Info
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: debug-logs
    path: |
      ~/.maestro/tests/**/
      screenshots/
```

**SSH into runner (debugging):**
```yaml
- name: Debug via SSH
  if: failure()
  uses: mxschmitt/action-tmate@v3
```

### Common CI Failures

**1. Simulator Boot Timeout**

```yaml
# Increase boot timeout
- name: Boot Simulator
  run: |
    xcrun simctl boot "iPhone 14" || true
    xcrun simctl bootstatus "iPhone 14" -b
```

**2. Emulator Boot Timeout**

```yaml
# Use emulator action with longer timeout
- uses: reactivecircus/android-emulator-runner@v2
  with:
    api-level: 33
    emulator-boot-timeout: 600
```

**3. Missing Dependencies**

```yaml
# Install all requirements
- name: Setup Environment
  run: |
    brew install ios-deploy
    npm install -g maestro
```

## Debugging Checklist

When test fails:

- [ ] Run with `--debug` flag
- [ ] Check element actually exists
- [ ] Verify selector syntax correct
- [ ] Add explicit waits after actions
- [ ] Check for overlays/modals blocking element
- [ ] Verify app in expected state
- [ ] Review device/simulator logs
- [ ] Test on different device/OS version
- [ ] Isolate problematic step
- [ ] Add diagnostic screenshots
- [ ] Check network requests completing
- [ ] Verify environment variables set
- [ ] Test flow in Maestro Studio

## Getting Help

**Maestro Community:**
- GitHub Issues: https://github.com/mobile-dev-inc/maestro/issues
- Discord: https://discord.gg/mobile-dev

**Share debugging info:**
```bash
# Maestro version
maestro --version

# Full debug output
maestro test --debug flow.yaml > debug.log 2>&1

# Device info
maestro doctor
```

Include in issue reports:
- Flow YAML
- Debug output
- Device/OS version
- Expected vs actual behavior
- Screenshots/videos
