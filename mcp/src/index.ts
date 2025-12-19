#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn, execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if Maestro CLI is installed, if not attempt to install it
 */
async function ensureMaestro(): Promise<void> {
  try {
    execSync("maestro --version", { stdio: "pipe" });
  } catch {
    console.error("Maestro not found. Installing...");
    try {
      // Install Maestro using the official installation script
      execSync("curl -Ls https://get.maestro.mobile.dev | bash", {
        stdio: "inherit",
        shell: "/bin/bash",
      });

      // Add to PATH for current session
      const maestroPath = path.join(os.homedir(), ".maestro", "bin");
      process.env.PATH = `${maestroPath}:${process.env.PATH}`;

      console.error("Maestro installed successfully");
    } catch (installError) {
      throw new Error(
        `Failed to install Maestro: ${installError instanceof Error ? installError.message : String(installError)}`
      );
    }
  }
}

/**
 * Execute a Maestro CLI command
 */
async function runMaestro(
  args: string[],
  options: { cwd?: string; input?: string } = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const maestroPath = path.join(os.homedir(), ".maestro", "bin", "maestro");
    const command = fs.existsSync(maestroPath) ? maestroPath : "maestro";

    const proc = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    if (options.input) {
      proc.stdin.write(options.input);
      proc.stdin.end();
    }

    proc.on("close", (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code: code || 0,
      });
    });

    proc.on("error", (error) => {
      reject(error);
    });
  });
}

// ============================================================================
// Tool Definitions
// ============================================================================

const tools: Tool[] = [
  // ========== Flow Execution (8 tools) ==========
  {
    name: "maestro_run_flow",
    description: "Execute a Maestro YAML flow file to test mobile app interactions",
    inputSchema: {
      type: "object",
      properties: {
        flowFile: {
          type: "string",
          description: "Path to the YAML flow file",
        },
        env: {
          type: "object",
          description: "Environment variables as key-value pairs",
          additionalProperties: { type: "string" },
        },
        device: {
          type: "string",
          description: "Specific device ID to run on",
        },
      },
      required: ["flowFile"],
    },
  },
  {
    name: "maestro_run_flows",
    description: "Execute multiple Maestro flows sequentially",
    inputSchema: {
      type: "object",
      properties: {
        flowFiles: {
          type: "array",
          description: "Array of paths to YAML flow files",
          items: { type: "string" },
        },
        env: {
          type: "object",
          description: "Environment variables as key-value pairs",
          additionalProperties: { type: "string" },
        },
      },
      required: ["flowFiles"],
    },
  },
  {
    name: "maestro_test",
    description: "Run Maestro flows with test assertions and reporting",
    inputSchema: {
      type: "object",
      properties: {
        flowPath: {
          type: "string",
          description: "Path to flow file or directory containing flows",
        },
        includeTags: {
          type: "array",
          description: "Only run flows with these tags",
          items: { type: "string" },
        },
        excludeTags: {
          type: "array",
          description: "Exclude flows with these tags",
          items: { type: "string" },
        },
        format: {
          type: "string",
          enum: ["junit", "html", "json"],
          description: "Output format for test results",
        },
        output: {
          type: "string",
          description: "Path to save test results",
        },
      },
      required: ["flowPath"],
    },
  },
  {
    name: "maestro_record",
    description: "Record user interactions to generate a Maestro flow",
    inputSchema: {
      type: "object",
      properties: {
        output: {
          type: "string",
          description: "Path to save the recorded flow YAML",
        },
        device: {
          type: "string",
          description: "Specific device ID to record on",
        },
      },
      required: ["output"],
    },
  },
  {
    name: "maestro_validate_flow",
    description: "Validate a Maestro YAML flow file syntax",
    inputSchema: {
      type: "object",
      properties: {
        flowFile: {
          type: "string",
          description: "Path to the YAML flow file to validate",
        },
      },
      required: ["flowFile"],
    },
  },
  {
    name: "maestro_upload",
    description: "Upload flows to Maestro Cloud for CI/CD execution",
    inputSchema: {
      type: "object",
      properties: {
        flowPath: {
          type: "string",
          description: "Path to flow file or directory",
        },
        appFile: {
          type: "string",
          description: "Path to APK or IPA file",
        },
        apiKey: {
          type: "string",
          description: "Maestro Cloud API key",
        },
        async: {
          type: "boolean",
          description: "Run asynchronously without waiting",
          default: false,
        },
      },
      required: ["flowPath", "appFile"],
    },
  },
  {
    name: "maestro_download_flow",
    description: "Download a flow from Maestro Cloud",
    inputSchema: {
      type: "object",
      properties: {
        flowId: {
          type: "string",
          description: "Cloud flow ID to download",
        },
        output: {
          type: "string",
          description: "Path to save downloaded flow",
        },
        apiKey: {
          type: "string",
          description: "Maestro Cloud API key",
        },
      },
      required: ["flowId", "output"],
    },
  },
  {
    name: "maestro_create_flow",
    description: "Create a new Maestro flow from template",
    inputSchema: {
      type: "object",
      properties: {
        output: {
          type: "string",
          description: "Path to save the new flow YAML",
        },
        template: {
          type: "string",
          enum: ["basic", "login", "navigation", "form"],
          description: "Template type to use",
          default: "basic",
        },
        appId: {
          type: "string",
          description: "App bundle ID or package name",
        },
      },
      required: ["output"],
    },
  },

  // ========== Device Control (7 tools) ==========
  {
    name: "maestro_list_devices",
    description: "List all connected devices and emulators",
    inputSchema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          enum: ["android", "ios", "all"],
          description: "Filter by platform",
          default: "all",
        },
      },
    },
  },
  {
    name: "maestro_connect_device",
    description: "Connect to a specific device or emulator",
    inputSchema: {
      type: "object",
      properties: {
        device: {
          type: "string",
          description: "Device ID or emulator name",
        },
        platform: {
          type: "string",
          enum: ["android", "ios"],
          description: "Device platform",
        },
      },
      required: ["device"],
    },
  },
  {
    name: "maestro_screenshot",
    description: "Capture a screenshot from the device",
    inputSchema: {
      type: "object",
      properties: {
        output: {
          type: "string",
          description: "Path to save screenshot (PNG)",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["output"],
    },
  },
  {
    name: "maestro_screen_recording_start",
    description: "Start recording device screen",
    inputSchema: {
      type: "object",
      properties: {
        output: {
          type: "string",
          description: "Path to save recording (MP4)",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["output"],
    },
  },
  {
    name: "maestro_screen_recording_stop",
    description: "Stop the current screen recording",
    inputSchema: {
      type: "object",
      properties: {
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
    },
  },
  {
    name: "maestro_hierarchy",
    description: "Get the current UI element hierarchy/tree",
    inputSchema: {
      type: "object",
      properties: {
        output: {
          type: "string",
          description: "Path to save hierarchy JSON",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
    },
  },
  {
    name: "maestro_device_info",
    description: "Get detailed device information",
    inputSchema: {
      type: "object",
      properties: {
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
    },
  },

  // ========== App Lifecycle (6 tools) ==========
  {
    name: "maestro_launch_app",
    description: "Launch an application on the device",
    inputSchema: {
      type: "object",
      properties: {
        appId: {
          type: "string",
          description: "App bundle ID (iOS) or package name (Android)",
        },
        stopApp: {
          type: "boolean",
          description: "Stop app first if already running",
          default: false,
        },
        clearState: {
          type: "boolean",
          description: "Clear app state before launch",
          default: false,
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["appId"],
    },
  },
  {
    name: "maestro_stop_app",
    description: "Stop a running application gracefully",
    inputSchema: {
      type: "object",
      properties: {
        appId: {
          type: "string",
          description: "App bundle ID (iOS) or package name (Android)",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["appId"],
    },
  },
  {
    name: "maestro_kill_app",
    description: "Force kill a running application",
    inputSchema: {
      type: "object",
      properties: {
        appId: {
          type: "string",
          description: "App bundle ID (iOS) or package name (Android)",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["appId"],
    },
  },
  {
    name: "maestro_clear_state",
    description: "Clear app data and cache",
    inputSchema: {
      type: "object",
      properties: {
        appId: {
          type: "string",
          description: "App bundle ID (iOS) or package name (Android)",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["appId"],
    },
  },
  {
    name: "maestro_clear_keychain",
    description: "Clear keychain/credential storage for an app (iOS)",
    inputSchema: {
      type: "object",
      properties: {
        appId: {
          type: "string",
          description: "App bundle ID",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["appId"],
    },
  },
  {
    name: "maestro_install_app",
    description: "Install an APK or IPA file on the device",
    inputSchema: {
      type: "object",
      properties: {
        appFile: {
          type: "string",
          description: "Path to APK (Android) or IPA (iOS) file",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
        reinstall: {
          type: "boolean",
          description: "Reinstall if already installed",
          default: false,
        },
      },
      required: ["appFile"],
    },
  },

  // ========== UI Interactions (12 tools) ==========
  {
    name: "maestro_tap",
    description: "Tap on an element or coordinates",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Element selector (text, id, etc.)",
        },
        x: {
          type: "number",
          description: "X coordinate (alternative to selector)",
        },
        y: {
          type: "number",
          description: "Y coordinate (alternative to selector)",
        },
        retries: {
          type: "number",
          description: "Number of retries if element not found",
          default: 3,
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
    },
  },
  {
    name: "maestro_double_tap",
    description: "Double tap on an element or coordinates",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Element selector (text, id, etc.)",
        },
        x: {
          type: "number",
          description: "X coordinate (alternative to selector)",
        },
        y: {
          type: "number",
          description: "Y coordinate (alternative to selector)",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
    },
  },
  {
    name: "maestro_long_press",
    description: "Long press on an element or coordinates",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Element selector (text, id, etc.)",
        },
        x: {
          type: "number",
          description: "X coordinate (alternative to selector)",
        },
        y: {
          type: "number",
          description: "Y coordinate (alternative to selector)",
        },
        duration: {
          type: "number",
          description: "Press duration in milliseconds",
          default: 1000,
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
    },
  },
  {
    name: "maestro_input_text",
    description: "Type text into an input field",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to input",
        },
        selector: {
          type: "string",
          description: "Element selector for input field",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "maestro_erase_text",
    description: "Clear text from an input field",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Element selector for input field",
        },
        charactersToErase: {
          type: "number",
          description: "Number of characters to erase (0 = all)",
          default: 0,
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
    },
  },
  {
    name: "maestro_swipe",
    description: "Perform a swipe gesture",
    inputSchema: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          enum: ["up", "down", "left", "right"],
          description: "Swipe direction",
        },
        duration: {
          type: "number",
          description: "Swipe duration in milliseconds",
          default: 300,
        },
        startX: {
          type: "number",
          description: "Start X coordinate (optional)",
        },
        startY: {
          type: "number",
          description: "Start Y coordinate (optional)",
        },
        endX: {
          type: "number",
          description: "End X coordinate (optional)",
        },
        endY: {
          type: "number",
          description: "End Y coordinate (optional)",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
    },
  },
  {
    name: "maestro_scroll",
    description: "Scroll in a direction",
    inputSchema: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          enum: ["up", "down", "left", "right"],
          description: "Scroll direction",
        },
        selector: {
          type: "string",
          description: "Element selector to scroll within",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
    },
  },
  {
    name: "maestro_press_key",
    description: "Press a device key",
    inputSchema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          enum: [
            "home",
            "back",
            "enter",
            "escape",
            "backspace",
            "power",
            "volume_up",
            "volume_down",
          ],
          description: "Key to press",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["key"],
    },
  },
  {
    name: "maestro_hide_keyboard",
    description: "Hide the on-screen keyboard",
    inputSchema: {
      type: "object",
      properties: {
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
    },
  },
  {
    name: "maestro_open_link",
    description: "Open a URL or deep link",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL or deep link to open",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "maestro_set_location",
    description: "Set device GPS location",
    inputSchema: {
      type: "object",
      properties: {
        latitude: {
          type: "number",
          description: "Latitude coordinate",
        },
        longitude: {
          type: "number",
          description: "Longitude coordinate",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["latitude", "longitude"],
    },
  },
  {
    name: "maestro_travel",
    description: "Simulate travel between two GPS coordinates",
    inputSchema: {
      type: "object",
      properties: {
        fromLat: {
          type: "number",
          description: "Starting latitude",
        },
        fromLon: {
          type: "number",
          description: "Starting longitude",
        },
        toLat: {
          type: "number",
          description: "Destination latitude",
        },
        toLon: {
          type: "number",
          description: "Destination longitude",
        },
        speed: {
          type: "number",
          description: "Travel speed in km/h",
          default: 50,
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["fromLat", "fromLon", "toLat", "toLon"],
    },
  },

  // ========== Assertions (6 tools) ==========
  {
    name: "maestro_assert_visible",
    description: "Assert that an element is visible",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Element selector (text, id, etc.)",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 5000,
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "maestro_assert_not_visible",
    description: "Assert that an element is not visible",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Element selector (text, id, etc.)",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 5000,
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "maestro_assert_true",
    description: "Assert that a condition is true",
    inputSchema: {
      type: "object",
      properties: {
        condition: {
          type: "string",
          description: "JavaScript expression to evaluate",
        },
        message: {
          type: "string",
          description: "Assertion failure message",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["condition"],
    },
  },
  {
    name: "maestro_wait_for",
    description: "Wait for an element to appear",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Element selector (text, id, etc.)",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 10000,
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "maestro_extract_text",
    description: "Extract text from an element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Element selector (text, id, etc.)",
        },
        variable: {
          type: "string",
          description: "Variable name to store extracted text",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "maestro_copy_text",
    description: "Copy text to device clipboard",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to copy",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["text"],
    },
  },

  // ========== System (5 tools) ==========
  {
    name: "maestro_set_orientation",
    description: "Set device screen orientation",
    inputSchema: {
      type: "object",
      properties: {
        orientation: {
          type: "string",
          enum: ["portrait", "landscape"],
          description: "Screen orientation",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["orientation"],
    },
  },
  {
    name: "maestro_toggle_airplane",
    description: "Toggle airplane mode on/off",
    inputSchema: {
      type: "object",
      properties: {
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
    },
  },
  {
    name: "maestro_set_airplane",
    description: "Set airplane mode to specific state",
    inputSchema: {
      type: "object",
      properties: {
        enabled: {
          type: "boolean",
          description: "Enable or disable airplane mode",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["enabled"],
    },
  },
  {
    name: "maestro_run_script",
    description: "Run a JavaScript script in the Maestro context",
    inputSchema: {
      type: "object",
      properties: {
        script: {
          type: "string",
          description: "JavaScript code to execute",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["script"],
    },
  },
  {
    name: "maestro_eval_script",
    description: "Evaluate a JavaScript expression and return result",
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "JavaScript expression to evaluate",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["expression"],
    },
  },

  // ========== AI-Powered (3 tools) ==========
  {
    name: "maestro_assert_with_ai",
    description: "Use AI to assert visual conditions on screen",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Natural language description of what to verify",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 10000,
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "maestro_extract_text_ai",
    description: "Use AI to extract text matching a description",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Natural language description of text to extract",
        },
        variable: {
          type: "string",
          description: "Variable name to store extracted text",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "maestro_assert_no_defects",
    description: "Use AI to detect visual defects on screen",
    inputSchema: {
      type: "object",
      properties: {
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
    },
  },
];

// ============================================================================
// Tool Handlers
// ============================================================================

async function handleToolCall(name: string, args: any): Promise<any> {
  // Ensure Maestro is installed before any operation
  await ensureMaestro();

  switch (name) {
    // ========== Flow Execution ==========
    case "maestro_run_flow": {
      const cmdArgs = ["test", args.flowFile];
      if (args.env) {
        for (const [key, value] of Object.entries(args.env)) {
          cmdArgs.push("-e", `${key}=${value}`);
        }
      }
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      return {
        success: result.code === 0,
        output: result.stdout,
        error: result.stderr,
      };
    }

    case "maestro_run_flows": {
      const results = [];
      for (const flowFile of args.flowFiles) {
        const cmdArgs = ["test", flowFile];
        if (args.env) {
          for (const [key, value] of Object.entries(args.env)) {
            cmdArgs.push("-e", `${key}=${value}`);
          }
        }
        const result = await runMaestro(cmdArgs);
        results.push({
          flow: flowFile,
          success: result.code === 0,
          output: result.stdout,
          error: result.stderr,
        });
      }
      return { results };
    }

    case "maestro_test": {
      const cmdArgs = ["test", args.flowPath];
      if (args.includeTags) {
        cmdArgs.push("--include-tags", args.includeTags.join(","));
      }
      if (args.excludeTags) {
        cmdArgs.push("--exclude-tags", args.excludeTags.join(","));
      }
      if (args.format) {
        cmdArgs.push("--format", args.format);
      }
      if (args.output) {
        cmdArgs.push("--output", args.output);
      }
      const result = await runMaestro(cmdArgs);
      return {
        success: result.code === 0,
        output: result.stdout,
        error: result.stderr,
      };
    }

    case "maestro_record": {
      const cmdArgs = ["record", "--output", args.output];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      return {
        success: result.code === 0,
        flowFile: args.output,
        output: result.stdout,
      };
    }

    case "maestro_validate_flow": {
      const cmdArgs = ["validate", args.flowFile];
      const result = await runMaestro(cmdArgs);
      return {
        valid: result.code === 0,
        output: result.stdout,
        errors: result.stderr,
      };
    }

    case "maestro_upload": {
      const cmdArgs = ["cloud", "upload"];
      cmdArgs.push("--app-file", args.appFile);
      cmdArgs.push("--flow", args.flowPath);
      if (args.apiKey) {
        cmdArgs.push("--api-key", args.apiKey);
      }
      if (args.async) {
        cmdArgs.push("--async");
      }
      const result = await runMaestro(cmdArgs);
      return {
        success: result.code === 0,
        output: result.stdout,
        error: result.stderr,
      };
    }

    case "maestro_download_flow": {
      const cmdArgs = ["cloud", "download", args.flowId, "--output", args.output];
      if (args.apiKey) {
        cmdArgs.push("--api-key", args.apiKey);
      }
      const result = await runMaestro(cmdArgs);
      return {
        success: result.code === 0,
        flowFile: args.output,
        output: result.stdout,
      };
    }

    case "maestro_create_flow": {
      // Create a basic flow template
      const templates: Record<string, string> = {
        basic: `appId: ${args.appId || "com.example.app"}
---
- launchApp
- tapOn: "Button"
- assertVisible: "Success"
`,
        login: `appId: ${args.appId || "com.example.app"}
---
- launchApp
- tapOn: "Username"
- inputText: "\${USERNAME}"
- tapOn: "Password"
- inputText: "\${PASSWORD}"
- tapOn: "Login"
- assertVisible: "Welcome"
`,
        navigation: `appId: ${args.appId || "com.example.app"}
---
- launchApp
- tapOn: "Menu"
- assertVisible: "Home"
- tapOn: "Settings"
- assertVisible: "Settings"
- pressKey: back
- assertVisible: "Home"
`,
        form: `appId: ${args.appId || "com.example.app"}
---
- launchApp
- tapOn: "Name"
- inputText: "John Doe"
- tapOn: "Email"
- inputText: "john@example.com"
- tapOn: "Submit"
- assertVisible: "Success"
`,
      };

      const content = templates[args.template || "basic"];
      fs.writeFileSync(args.output, content, "utf8");
      return {
        success: true,
        flowFile: args.output,
        template: args.template || "basic",
      };
    }

    // ========== Device Control ==========
    case "maestro_list_devices": {
      const result = await runMaestro(["devices"]);
      return {
        devices: result.stdout,
        raw: result.stdout,
      };
    }

    case "maestro_connect_device": {
      const cmdArgs = ["--device", args.device];
      if (args.platform) {
        cmdArgs.push("--platform", args.platform);
      }
      cmdArgs.push("devices");
      const result = await runMaestro(cmdArgs);
      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_screenshot": {
      const cmdArgs = ["screenshot", "--output", args.output];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      return {
        success: result.code === 0,
        screenshotFile: args.output,
        output: result.stdout,
      };
    }

    case "maestro_screen_recording_start": {
      const cmdArgs = ["record-screen", "--output", args.output];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      return {
        success: result.code === 0,
        recordingFile: args.output,
        output: result.stdout,
      };
    }

    case "maestro_screen_recording_stop": {
      const cmdArgs = ["stop-recording"];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_hierarchy": {
      const cmdArgs = ["hierarchy"];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      if (args.output) {
        cmdArgs.push("--output", args.output);
      }
      const result = await runMaestro(cmdArgs);
      return {
        success: result.code === 0,
        hierarchy: result.stdout,
        output: args.output,
      };
    }

    case "maestro_device_info": {
      const cmdArgs = ["info"];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      return {
        success: result.code === 0,
        info: result.stdout,
      };
    }

    // ========== App Lifecycle ==========
    case "maestro_launch_app": {
      // Create a temporary flow to launch the app
      const flowContent = `appId: ${args.appId}
---
${args.clearState ? "- clearState\n" : ""}${args.stopApp ? "- stopApp\n" : ""}- launchApp
`;
      const tempFlow = path.join(os.tmpdir(), `maestro_launch_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_stop_app": {
      const flowContent = `appId: ${args.appId}
---
- stopApp
`;
      const tempFlow = path.join(os.tmpdir(), `maestro_stop_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_kill_app": {
      const flowContent = `appId: ${args.appId}
---
- killApp
`;
      const tempFlow = path.join(os.tmpdir(), `maestro_kill_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_clear_state": {
      const flowContent = `appId: ${args.appId}
---
- clearState
`;
      const tempFlow = path.join(os.tmpdir(), `maestro_clear_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_clear_keychain": {
      const flowContent = `appId: ${args.appId}
---
- clearKeychain
`;
      const tempFlow = path.join(os.tmpdir(), `maestro_keychain_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_install_app": {
      const cmdArgs = ["install"];
      cmdArgs.push(args.appFile);
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      if (args.reinstall) {
        cmdArgs.push("--force");
      }
      const result = await runMaestro(cmdArgs);
      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    // ========== UI Interactions ==========
    case "maestro_tap": {
      let flowContent = `---\n`;
      if (args.selector) {
        flowContent += `- tapOn: "${args.selector}"\n`;
        if (args.retries) {
          flowContent += `  retries: ${args.retries}\n`;
        }
      } else if (args.x !== undefined && args.y !== undefined) {
        flowContent += `- tapOn:\n    point: ${args.x},${args.y}\n`;
      }

      const tempFlow = path.join(os.tmpdir(), `maestro_tap_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_double_tap": {
      let flowContent = `---\n`;
      if (args.selector) {
        flowContent += `- doubleTapOn: "${args.selector}"\n`;
      } else if (args.x !== undefined && args.y !== undefined) {
        flowContent += `- doubleTapOn:\n    point: ${args.x},${args.y}\n`;
      }

      const tempFlow = path.join(os.tmpdir(), `maestro_dtap_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_long_press": {
      let flowContent = `---\n`;
      if (args.selector) {
        flowContent += `- longPressOn: "${args.selector}"\n`;
      } else if (args.x !== undefined && args.y !== undefined) {
        flowContent += `- longPressOn:\n    point: ${args.x},${args.y}\n`;
      }
      if (args.duration) {
        flowContent += `  duration: ${args.duration}\n`;
      }

      const tempFlow = path.join(os.tmpdir(), `maestro_lpress_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_input_text": {
      let flowContent = `---\n`;
      if (args.selector) {
        flowContent += `- tapOn: "${args.selector}"\n`;
      }
      flowContent += `- inputText: "${args.text}"\n`;

      const tempFlow = path.join(os.tmpdir(), `maestro_input_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_erase_text": {
      let flowContent = `---\n`;
      if (args.selector) {
        flowContent += `- tapOn: "${args.selector}"\n`;
      }
      if (args.charactersToErase > 0) {
        flowContent += `- eraseText: ${args.charactersToErase}\n`;
      } else {
        flowContent += `- eraseText\n`;
      }

      const tempFlow = path.join(os.tmpdir(), `maestro_erase_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_swipe": {
      let flowContent = `---\n- swipe:\n`;
      if (args.direction) {
        flowContent += `    direction: ${args.direction}\n`;
      } else if (
        args.startX !== undefined &&
        args.startY !== undefined &&
        args.endX !== undefined &&
        args.endY !== undefined
      ) {
        flowContent += `    start: ${args.startX},${args.startY}\n`;
        flowContent += `    end: ${args.endX},${args.endY}\n`;
      }
      if (args.duration) {
        flowContent += `    duration: ${args.duration}\n`;
      }

      const tempFlow = path.join(os.tmpdir(), `maestro_swipe_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_scroll": {
      let flowContent = `---\n- scroll`;
      if (args.direction) {
        flowContent += `:\n    direction: ${args.direction}\n`;
      }
      if (args.selector) {
        flowContent += `    within: "${args.selector}"\n`;
      }

      const tempFlow = path.join(os.tmpdir(), `maestro_scroll_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_press_key": {
      const flowContent = `---\n- pressKey: ${args.key}\n`;

      const tempFlow = path.join(os.tmpdir(), `maestro_key_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_hide_keyboard": {
      const flowContent = `---\n- hideKeyboard\n`;

      const tempFlow = path.join(os.tmpdir(), `maestro_keyboard_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_open_link": {
      const flowContent = `---\n- openLink: "${args.url}"\n`;

      const tempFlow = path.join(os.tmpdir(), `maestro_link_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_set_location": {
      const flowContent = `---\n- setLocation:\n    latitude: ${args.latitude}\n    longitude: ${args.longitude}\n`;

      const tempFlow = path.join(os.tmpdir(), `maestro_location_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_travel": {
      const flowContent = `---\n- travel:\n    from:\n      latitude: ${args.fromLat}\n      longitude: ${args.fromLon}\n    to:\n      latitude: ${args.toLat}\n      longitude: ${args.toLon}\n    speed: ${args.speed || 50}\n`;

      const tempFlow = path.join(os.tmpdir(), `maestro_travel_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    // ========== Assertions ==========
    case "maestro_assert_visible": {
      const flowContent = `---\n- assertVisible:\n    text: "${args.selector}"\n    timeout: ${args.timeout || 5000}\n`;

      const tempFlow = path.join(os.tmpdir(), `maestro_assert_vis_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
        error: result.stderr,
      };
    }

    case "maestro_assert_not_visible": {
      const flowContent = `---\n- assertNotVisible:\n    text: "${args.selector}"\n    timeout: ${args.timeout || 5000}\n`;

      const tempFlow = path.join(os.tmpdir(), `maestro_assert_not_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
        error: result.stderr,
      };
    }

    case "maestro_assert_true": {
      const flowContent = `---\n- assertTrue: ${args.condition}\n${args.message ? `  message: "${args.message}"\n` : ""}`;

      const tempFlow = path.join(os.tmpdir(), `maestro_assert_true_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
        error: result.stderr,
      };
    }

    case "maestro_wait_for": {
      const flowContent = `---\n- waitFor:\n    text: "${args.selector}"\n    timeout: ${args.timeout || 10000}\n`;

      const tempFlow = path.join(os.tmpdir(), `maestro_wait_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_extract_text": {
      const flowContent = `---\n- extendedWaitUntil:\n    visible:\n      text: "${args.selector}"\n- copyTextFrom:\n    text: "${args.selector}"\n${args.variable ? `  to: ${args.variable}\n` : ""}`;

      const tempFlow = path.join(os.tmpdir(), `maestro_extract_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
        variable: args.variable,
      };
    }

    case "maestro_copy_text": {
      const flowContent = `---\n- runScript: |\n    output.clipboard = "${args.text.replace(/"/g, '\\"')}"\n`;

      const tempFlow = path.join(os.tmpdir(), `maestro_copy_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    // ========== System ==========
    case "maestro_set_orientation": {
      const flowContent = `---\n- setOrientation: ${args.orientation}\n`;

      const tempFlow = path.join(os.tmpdir(), `maestro_orient_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_toggle_airplane": {
      const flowContent = `---\n- toggleAirplaneMode\n`;

      const tempFlow = path.join(os.tmpdir(), `maestro_airplane_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_set_airplane": {
      const flowContent = `---\n- setAirplaneMode: ${args.enabled}\n`;

      const tempFlow = path.join(os.tmpdir(), `maestro_airplane_set_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_run_script": {
      const flowContent = `---\n- runScript: |\n${args.script.split("\n").map((line: string) => `    ${line}`).join("\n")}\n`;

      const tempFlow = path.join(os.tmpdir(), `maestro_script_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
      };
    }

    case "maestro_eval_script": {
      const flowContent = `---\n- evalScript: ${args.expression}\n`;

      const tempFlow = path.join(os.tmpdir(), `maestro_eval_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        result: result.stdout,
      };
    }

    // ========== AI-Powered ==========
    case "maestro_assert_with_ai": {
      const flowContent = `---\n- assertWithAI: "${args.prompt}"\n  timeout: ${args.timeout || 10000}\n`;

      const tempFlow = path.join(os.tmpdir(), `maestro_ai_assert_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
        error: result.stderr,
      };
    }

    case "maestro_extract_text_ai": {
      const flowContent = `---\n- extractTextWithAI: "${args.prompt}"\n${args.variable ? `  to: ${args.variable}\n` : ""}`;

      const tempFlow = path.join(os.tmpdir(), `maestro_ai_extract_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
        variable: args.variable,
      };
    }

    case "maestro_assert_no_defects": {
      const flowContent = `---\n- assertNoDefects\n`;

      const tempFlow = path.join(os.tmpdir(), `maestro_ai_defects_${Date.now()}.yaml`);
      fs.writeFileSync(tempFlow, flowContent, "utf8");

      const cmdArgs = ["test", tempFlow];
      if (args.device) {
        cmdArgs.push("--device", args.device);
      }
      const result = await runMaestro(cmdArgs);
      fs.unlinkSync(tempFlow);

      return {
        success: result.code === 0,
        output: result.stdout,
        defects: result.code === 0 ? [] : result.stderr,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ============================================================================
// Server Setup
// ============================================================================

const server = new Server(
  {
    name: "maestro-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await handleToolCall(request.params.name, request.params.arguments || {});
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: error instanceof Error ? error.message : String(error),
              tool: request.params.name,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// ============================================================================
// Start Server
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Maestro MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
