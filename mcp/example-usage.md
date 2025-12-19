# Maestro MCP Server - Usage Examples

## Tool Categories Verification

✅ **47 Tools Total**

- Flow Execution: 8 tools
- Device Control: 7 tools
- App Lifecycle: 6 tools
- UI Interactions: 12 tools
- Assertions: 6 tools
- System: 5 tools
- AI-Powered: 3 tools

## Example Workflows

### 1. Complete Login Test Flow

```json
[
  {
    "tool": "maestro_list_devices",
    "args": {}
  },
  {
    "tool": "maestro_launch_app",
    "args": {
      "appId": "com.example.app",
      "clearState": true
    }
  },
  {
    "tool": "maestro_tap",
    "args": {
      "selector": "Username"
    }
  },
  {
    "tool": "maestro_input_text",
    "args": {
      "text": "${USERNAME}"
    }
  },
  {
    "tool": "maestro_tap",
    "args": {
      "selector": "Password"
    }
  },
  {
    "tool": "maestro_input_text",
    "args": {
      "text": "${PASSWORD}"
    }
  },
  {
    "tool": "maestro_tap",
    "args": {
      "selector": "Login"
    }
  },
  {
    "tool": "maestro_assert_visible",
    "args": {
      "selector": "Welcome",
      "timeout": 5000
    }
  },
  {
    "tool": "maestro_screenshot",
    "args": {
      "output": "/tmp/login-success.png"
    }
  }
]
```

### 2. Create and Run Custom Flow

```json
[
  {
    "tool": "maestro_create_flow",
    "args": {
      "output": "/tmp/my-test.yaml",
      "template": "login",
      "appId": "com.myapp"
    }
  },
  {
    "tool": "maestro_validate_flow",
    "args": {
      "flowFile": "/tmp/my-test.yaml"
    }
  },
  {
    "tool": "maestro_run_flow",
    "args": {
      "flowFile": "/tmp/my-test.yaml",
      "env": {
        "USERNAME": "testuser@example.com",
        "PASSWORD": "SecurePass123"
      }
    }
  }
]
```

### 3. AI-Powered Testing

```json
[
  {
    "tool": "maestro_launch_app",
    "args": {
      "appId": "com.example.app"
    }
  },
  {
    "tool": "maestro_assert_with_ai",
    "args": {
      "prompt": "The home screen should display a welcome message and navigation menu"
    }
  },
  {
    "tool": "maestro_extract_text_ai",
    "args": {
      "prompt": "Extract the user's display name from the profile section",
      "variable": "displayName"
    }
  },
  {
    "tool": "maestro_assert_no_defects",
    "args": {}
  }
]
```

### 4. Location-Based Testing

```json
[
  {
    "tool": "maestro_launch_app",
    "args": {
      "appId": "com.rideshare.app"
    }
  },
  {
    "tool": "maestro_set_location",
    "args": {
      "latitude": 37.7749,
      "longitude": -122.4194
    }
  },
  {
    "tool": "maestro_tap",
    "args": {
      "selector": "Find Drivers"
    }
  },
  {
    "tool": "maestro_travel",
    "args": {
      "fromLat": 37.7749,
      "fromLon": -122.4194,
      "toLat": 37.7849,
      "toLon": -122.4094,
      "speed": 30
    }
  }
]
```

### 5. Recording and Playback

```json
[
  {
    "tool": "maestro_record",
    "args": {
      "output": "/tmp/recorded-flow.yaml"
    }
  }
]
```

After manual interaction, the flow is saved. Then replay:

```json
[
  {
    "tool": "maestro_run_flow",
    "args": {
      "flowFile": "/tmp/recorded-flow.yaml"
    }
  }
]
```

### 6. Multi-Device Testing

```json
[
  {
    "tool": "maestro_list_devices",
    "args": {
      "platform": "android"
    }
  },
  {
    "tool": "maestro_run_flow",
    "args": {
      "flowFile": "/path/to/test.yaml",
      "device": "emulator-5554"
    }
  },
  {
    "tool": "maestro_run_flow",
    "args": {
      "flowFile": "/path/to/test.yaml",
      "device": "emulator-5556"
    }
  }
]
```

### 7. Complete Test Suite with Reporting

```json
[
  {
    "tool": "maestro_test",
    "args": {
      "flowPath": "/tests/flows/",
      "includeTags": ["smoke", "critical"],
      "format": "junit",
      "output": "/reports/test-results.xml"
    }
  }
]
```

### 8. Gesture Testing

```json
[
  {
    "tool": "maestro_launch_app",
    "args": {
      "appId": "com.gallery.app"
    }
  },
  {
    "tool": "maestro_swipe",
    "args": {
      "direction": "left"
    }
  },
  {
    "tool": "maestro_swipe",
    "args": {
      "direction": "left"
    }
  },
  {
    "tool": "maestro_double_tap",
    "args": {
      "selector": "Photo"
    }
  },
  {
    "tool": "maestro_long_press",
    "args": {
      "selector": "Photo",
      "duration": 2000
    }
  }
]
```

### 9. Cloud Integration

```json
[
  {
    "tool": "maestro_upload",
    "args": {
      "flowPath": "/tests/flows/",
      "appFile": "/builds/app-release.apk",
      "apiKey": "your-api-key",
      "async": false
    }
  }
]
```

### 10. System State Testing

```json
[
  {
    "tool": "maestro_launch_app",
    "args": {
      "appId": "com.messaging.app"
    }
  },
  {
    "tool": "maestro_set_airplane",
    "args": {
      "enabled": true
    }
  },
  {
    "tool": "maestro_assert_visible",
    "args": {
      "selector": "No Connection"
    }
  },
  {
    "tool": "maestro_set_airplane",
    "args": {
      "enabled": false
    }
  },
  {
    "tool": "maestro_wait_for",
    "args": {
      "selector": "Connected",
      "timeout": 10000
    }
  },
  {
    "tool": "maestro_set_orientation",
    "args": {
      "orientation": "landscape"
    }
  },
  {
    "tool": "maestro_screenshot",
    "args": {
      "output": "/tmp/landscape-view.png"
    }
  }
]
```

## Tool Return Values

All tools return structured JSON:

```typescript
{
  success: boolean;      // Operation succeeded
  output: string;        // Maestro stdout
  error?: string;        // Maestro stderr if any
  // Tool-specific fields...
}
```

### Example Success Response

```json
{
  "success": true,
  "output": "✓ Test passed\n✓ All assertions successful",
  "flowFile": "/tmp/test.yaml"
}
```

### Example Error Response

```json
{
  "success": false,
  "output": "",
  "error": "Element 'Login' not found after 5000ms"
}
```

## Best Practices

1. **Always check device availability first**
   ```json
   {"tool": "maestro_list_devices"}
   ```

2. **Use AI tools for complex validations**
   ```json
   {"tool": "maestro_assert_with_ai", "args": {"prompt": "..."}}
   ```

3. **Clean state between tests**
   ```json
   {"tool": "maestro_launch_app", "args": {"appId": "...", "clearState": true}}
   ```

4. **Capture screenshots on critical steps**
   ```json
   {"tool": "maestro_screenshot", "args": {"output": "/tmp/step-3.png"}}
   ```

5. **Use templates for common flows**
   ```json
   {"tool": "maestro_create_flow", "args": {"template": "login"}}
   ```

6. **Validate flows before running**
   ```json
   {"tool": "maestro_validate_flow", "args": {"flowFile": "..."}}
   ```

7. **Set appropriate timeouts**
   ```json
   {"tool": "maestro_wait_for", "args": {"timeout": 15000}}
   ```

8. **Use environment variables for credentials**
   ```json
   {"tool": "maestro_run_flow", "args": {"env": {"USER": "...", "PASS": "..."}}}
   ```
