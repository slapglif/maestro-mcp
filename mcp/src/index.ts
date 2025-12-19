#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { spawn, execSync, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ============================================================================
// Constants
// ============================================================================

const MAX_IMAGE_DIMENSION = 1800; // Resize images larger than this
const MAESTRO_MCP_TIMEOUT = 30000; // 30 seconds

// ============================================================================
// Maestro Native MCP Client
// ============================================================================

class MaestroMCPClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();
  private buffer = "";
  private ready = false;

  async start(): Promise<void> {
    if (this.process) return;

    const maestroPath = path.join(os.homedir(), ".maestro", "bin", "maestro");
    const command = fs.existsSync(maestroPath) ? maestroPath : "maestro";

    this.process = spawn(command, ["mcp"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    this.process.stdout?.on("data", (data) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.process.stderr?.on("data", (data) => {
      const msg = data.toString();
      if (msg.includes("Started")) {
        this.ready = true;
      }
    });

    this.process.on("error", (err) => {
      console.error("Maestro MCP process error:", err);
    });

    this.process.on("close", (code) => {
      this.ready = false;
      this.process = null;
    });

    // Wait for ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Maestro MCP startup timeout")), 10000);
      const check = setInterval(() => {
        if (this.ready) {
          clearInterval(check);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    });
  }

  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim() || line.includes("MCP Server:")) continue;
      try {
        const response = JSON.parse(line);
        if (response.id && this.pendingRequests.has(response.id)) {
          const { resolve, reject } = this.pendingRequests.get(response.id)!;
          this.pendingRequests.delete(response.id);
          if (response.error) {
            reject(new Error(response.error.message || JSON.stringify(response.error)));
          } else {
            resolve(response.result);
          }
        }
      } catch (e) {
        // Ignore non-JSON lines
      }
    }
  }

  async call(method: string, params: any = {}): Promise<any> {
    await this.start();

    const id = ++this.requestId;
    const request = { jsonrpc: "2.0", id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Maestro MCP timeout for ${method}`));
      }, MAESTRO_MCP_TIMEOUT);

      this.pendingRequests.set(id, {
        resolve: (result: any) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error: any) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.process?.stdin?.write(JSON.stringify(request) + "\n");
    });
  }

  async callTool(name: string, args: any = {}): Promise<any> {
    const result = await this.call("tools/call", { name, arguments: args });
    // Parse the content from MCP response
    if (result?.content?.[0]?.text) {
      try {
        return JSON.parse(result.content[0].text);
      } catch {
        return result.content[0].text;
      }
    }
    return result;
  }

  stop(): void {
    this.process?.kill();
    this.process = null;
    this.ready = false;
  }
}

const maestroClient = new MaestroMCPClient();

// ============================================================================
// ADB Helper Functions
// ============================================================================

function runAdb(args: string[], timeout = 30000): { stdout: string; stderr: string; code: number } {
  try {
    const result = execSync(`adb ${args.join(" ")}`, {
      timeout,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout: result, stderr: "", code: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || error.message,
      code: error.status || 1,
    };
  }
}

function getAdbDevices(): Array<{ id: string; status: string; platform: string }> {
  const result = runAdb(["devices"]);
  const lines = result.stdout.split("\n").slice(1).filter(Boolean);
  return lines.map((line) => {
    const [id, status] = line.split("\t");
    return { id: id.trim(), status: status?.trim() || "unknown", platform: "android" };
  }).filter(d => d.id && d.status === "device");
}

function getDefaultDevice(): string | null {
  const devices = getAdbDevices();
  return devices.length > 0 ? devices[0].id : null;
}

// ============================================================================
// Screenshot Sanitization
// ============================================================================

async function sanitizeScreenshot(imagePath: string): Promise<string> {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Screenshot file not found: ${imagePath}`);
  }

  // Check image dimensions using identify (ImageMagick) or file
  try {
    const identify = execSync(`identify -format "%w %h" "${imagePath}" 2>/dev/null`, { encoding: "utf8" });
    const [width, height] = identify.trim().split(" ").map(Number);

    if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
      const sanitizedPath = imagePath.replace(/(\.[^.]+)$/, "_sanitized$1");
      execSync(`convert "${imagePath}" -resize ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION}\\> "${sanitizedPath}"`, {
        encoding: "utf8",
      });
      return sanitizedPath;
    }
  } catch {
    // ImageMagick not available, try with file command to at least report dimensions
    console.error("ImageMagick not available for image resizing");
  }

  return imagePath;
}

async function takeAdbScreenshot(device: string, outputPath: string): Promise<string> {
  // Take screenshot via ADB
  const tmpPath = "/sdcard/screenshot_tmp.png";
  runAdb(["-s", device, "shell", "screencap", "-p", tmpPath]);
  runAdb(["-s", device, "pull", tmpPath, outputPath]);
  runAdb(["-s", device, "shell", "rm", tmpPath]);

  // Sanitize (resize if needed)
  return await sanitizeScreenshot(outputPath);
}

// ============================================================================
// UI Hierarchy Parsing
// ============================================================================

interface UIElement {
  text: string;
  id: string;
  className: string;
  bounds: { x: number; y: number; width: number; height: number };
  center: { x: number; y: number };
  clickable: boolean;
  enabled: boolean;
  focused: boolean;
  selected: boolean;
  checked: boolean;
}

function parseUiHierarchy(xmlContent: string): UIElement[] {
  const elements: UIElement[] = [];

  // Parse XML nodes with regex (simplified - works for uiautomator dump output)
  const nodeRegex = /<node[^>]+>/g;
  let match;

  while ((match = nodeRegex.exec(xmlContent)) !== null) {
    const node = match[0];

    const getText = (attr: string): string => {
      const m = node.match(new RegExp(`${attr}="([^"]*)"`));
      return m ? m[1] : "";
    };

    const getBool = (attr: string): boolean => getText(attr) === "true";

    const boundsStr = getText("bounds");
    const boundsMatch = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);

    if (boundsMatch) {
      const x1 = parseInt(boundsMatch[1]);
      const y1 = parseInt(boundsMatch[2]);
      const x2 = parseInt(boundsMatch[3]);
      const y2 = parseInt(boundsMatch[4]);

      const element: UIElement = {
        text: getText("text"),
        id: getText("resource-id"),
        className: getText("class"),
        bounds: { x: x1, y: y1, width: x2 - x1, height: y2 - y1 },
        center: { x: Math.round((x1 + x2) / 2), y: Math.round((y1 + y2) / 2) },
        clickable: getBool("clickable"),
        enabled: getBool("enabled"),
        focused: getBool("focused"),
        selected: getBool("selected"),
        checked: getBool("checked"),
      };

      // Only include elements with text or id
      if (element.text || element.id) {
        elements.push(element);
      }
    }
  }

  return elements;
}

function findElements(elements: UIElement[], query: { text?: string; id?: string; fuzzy?: boolean }): UIElement[] {
  return elements.filter((el) => {
    if (query.text) {
      if (query.fuzzy) {
        if (!el.text.toLowerCase().includes(query.text.toLowerCase())) return false;
      } else {
        if (el.text !== query.text) return false;
      }
    }
    if (query.id) {
      if (query.fuzzy) {
        if (!el.id.toLowerCase().includes(query.id.toLowerCase())) return false;
      } else {
        if (el.id !== query.id) return false;
      }
    }
    return true;
  });
}

function getAdbHierarchy(device: string): UIElement[] {
  const tmpPath = "/sdcard/ui_hierarchy.xml";
  const localPath = path.join(os.tmpdir(), `ui_hierarchy_${Date.now()}.xml`);

  runAdb(["-s", device, "shell", "uiautomator", "dump", tmpPath]);
  runAdb(["-s", device, "pull", tmpPath, localPath]);
  runAdb(["-s", device, "shell", "rm", tmpPath]);

  const content = fs.readFileSync(localPath, "utf8");
  fs.unlinkSync(localPath);

  return parseUiHierarchy(content);
}

// ============================================================================
// Tool Definitions
// ============================================================================

const tools: Tool[] = [
  // ========== Maestro Native Tools (Proxied) ==========
  {
    name: "maestro_list_devices",
    description: "List all available devices (emulators/simulators) that can be used for automation",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "maestro_start_device",
    description: "Start a device (simulator/emulator). Provide device_id from list_devices, or platform (ios/android)",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "Device ID from list_devices" },
        platform: { type: "string", enum: ["ios", "android"], description: "Platform to start" },
      },
    },
  },
  {
    name: "maestro_screenshot",
    description: "Take a screenshot of the device. Returns base64 image data. Images are auto-resized to max 1800px.",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "Device ID (required)" },
        output: { type: "string", description: "Optional: save to file path" },
      },
      required: ["device_id"],
    },
  },
  {
    name: "maestro_hierarchy",
    description: "Get the UI element hierarchy of the current screen. Returns elements with bounds and center coordinates for easy tapping.",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "Device ID (required)" },
      },
      required: ["device_id"],
    },
  },
  {
    name: "maestro_tap",
    description: "Tap on a UI element by text or ID. Uses fuzzy matching by default. Returns the tapped element's center coordinates.",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "Device ID (required)" },
        text: { type: "string", description: "Text content to match" },
        id: { type: "string", description: "Resource ID to match" },
        fuzzy: { type: "boolean", description: "Use fuzzy matching (default: true)", default: true },
        index: { type: "integer", description: "Index if multiple matches (0-based)" },
      },
      required: ["device_id"],
    },
  },
  {
    name: "maestro_tap_coordinates",
    description: "Tap at specific x,y coordinates on the device",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "Device ID (required)" },
        x: { type: "number", description: "X coordinate" },
        y: { type: "number", description: "Y coordinate" },
      },
      required: ["device_id", "x", "y"],
    },
  },
  {
    name: "maestro_input_text",
    description: "Type text into the currently focused input field",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "Device ID (required)" },
        text: { type: "string", description: "Text to type" },
      },
      required: ["device_id", "text"],
    },
  },
  {
    name: "maestro_back",
    description: "Press the back button",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "Device ID (required)" },
      },
      required: ["device_id"],
    },
  },
  {
    name: "maestro_launch_app",
    description: "Launch an application on the device",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "Device ID (required)" },
        app_id: { type: "string", description: "Bundle ID / package name" },
      },
      required: ["device_id", "app_id"],
    },
  },
  {
    name: "maestro_stop_app",
    description: "Stop an application on the device",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "Device ID (required)" },
        app_id: { type: "string", description: "Bundle ID / package name" },
      },
      required: ["device_id", "app_id"],
    },
  },
  {
    name: "maestro_run_flow",
    description: "Run Maestro flow YAML commands directly (for complex sequences)",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "Device ID (required)" },
        flow_yaml: { type: "string", description: "YAML flow content" },
        env: { type: "object", description: "Environment variables" },
      },
      required: ["device_id", "flow_yaml"],
    },
  },
  {
    name: "maestro_cheat_sheet",
    description: "Get Maestro command syntax reference",
    inputSchema: { type: "object", properties: {} },
  },

  // ========== ADB Direct Tools ==========
  {
    name: "adb_devices",
    description: "List connected Android devices via ADB (works even if Maestro fails)",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "adb_screenshot",
    description: "Take screenshot via ADB directly. Auto-resizes to max 1800px.",
    inputSchema: {
      type: "object",
      properties: {
        device: { type: "string", description: "Device ID (optional, uses first device)" },
        output: { type: "string", description: "Output file path (required)" },
      },
      required: ["output"],
    },
  },
  {
    name: "adb_hierarchy",
    description: "Get UI hierarchy via ADB (uiautomator). Returns elements with text, id, bounds, and CENTER COORDINATES for easy tapping.",
    inputSchema: {
      type: "object",
      properties: {
        device: { type: "string", description: "Device ID (optional)" },
      },
    },
  },
  {
    name: "adb_find_element",
    description: "Find UI element by text or ID and return its CENTER COORDINATES. Use this to get tap coordinates!",
    inputSchema: {
      type: "object",
      properties: {
        device: { type: "string", description: "Device ID (optional)" },
        text: { type: "string", description: "Text to find (fuzzy match)" },
        id: { type: "string", description: "Resource ID to find (fuzzy match)" },
        index: { type: "integer", description: "Index if multiple matches (0-based)", default: 0 },
      },
    },
  },
  {
    name: "adb_tap",
    description: "Tap at coordinates via ADB",
    inputSchema: {
      type: "object",
      properties: {
        device: { type: "string", description: "Device ID (optional)" },
        x: { type: "number", description: "X coordinate" },
        y: { type: "number", description: "Y coordinate" },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "adb_tap_element",
    description: "Find element by text/id and tap its CENTER. Combines find + tap in one call!",
    inputSchema: {
      type: "object",
      properties: {
        device: { type: "string", description: "Device ID (optional)" },
        text: { type: "string", description: "Text to find and tap" },
        id: { type: "string", description: "Resource ID to find and tap" },
        index: { type: "integer", description: "Index if multiple matches", default: 0 },
      },
    },
  },
  {
    name: "adb_input_text",
    description: "Input text via ADB. Special chars are escaped automatically.",
    inputSchema: {
      type: "object",
      properties: {
        device: { type: "string", description: "Device ID (optional)" },
        text: { type: "string", description: "Text to input" },
      },
      required: ["text"],
    },
  },
  {
    name: "adb_press_key",
    description: "Press a key via ADB (back, home, enter, tab, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        device: { type: "string", description: "Device ID (optional)" },
        key: {
          type: "string",
          enum: ["back", "home", "enter", "tab", "delete", "escape", "menu", "search", "volume_up", "volume_down", "power"],
          description: "Key to press",
        },
      },
      required: ["key"],
    },
  },
  {
    name: "adb_swipe",
    description: "Swipe gesture via ADB",
    inputSchema: {
      type: "object",
      properties: {
        device: { type: "string", description: "Device ID (optional)" },
        direction: { type: "string", enum: ["up", "down", "left", "right"], description: "Swipe direction" },
        start_x: { type: "number", description: "Start X (optional, default: center)" },
        start_y: { type: "number", description: "Start Y (optional, default: center)" },
        distance: { type: "number", description: "Swipe distance in pixels", default: 500 },
        duration: { type: "number", description: "Duration in ms", default: 300 },
      },
      required: ["direction"],
    },
  },
  {
    name: "adb_launch_app",
    description: "Launch app via ADB am start",
    inputSchema: {
      type: "object",
      properties: {
        device: { type: "string", description: "Device ID (optional)" },
        package: { type: "string", description: "Package name (e.g., com.example.app)" },
        activity: { type: "string", description: "Activity to launch (optional)" },
        uri: { type: "string", description: "URI to open (optional, e.g., deep link)" },
      },
      required: ["package"],
    },
  },
  {
    name: "adb_shell",
    description: "Run arbitrary ADB shell command",
    inputSchema: {
      type: "object",
      properties: {
        device: { type: "string", description: "Device ID (optional)" },
        command: { type: "string", description: "Shell command to run" },
      },
      required: ["command"],
    },
  },
];

// ============================================================================
// Tool Handlers
// ============================================================================

async function handleToolCall(name: string, args: any): Promise<any> {
  // ========== Maestro Native Tools ==========
  if (name === "maestro_list_devices") {
    try {
      const result = await maestroClient.callTool("list_devices", {});
      return result;
    } catch (error) {
      // Fallback to ADB
      return { devices: getAdbDevices(), source: "adb_fallback" };
    }
  }

  if (name === "maestro_start_device") {
    return await maestroClient.callTool("start_device", {
      device_id: args.device_id,
      platform: args.platform,
    });
  }

  if (name === "maestro_screenshot") {
    try {
      const result = await maestroClient.callTool("take_screenshot", {
        device_id: args.device_id,
      });

      // If output path specified, save the base64 image
      if (args.output && result.image) {
        const imageData = result.image.replace(/^data:image\/\w+;base64,/, "");
        fs.writeFileSync(args.output, Buffer.from(imageData, "base64"));
        const sanitized = await sanitizeScreenshot(args.output);
        return { success: true, file: sanitized, sanitized: sanitized !== args.output };
      }

      return result;
    } catch (error) {
      // Fallback to ADB
      const device = args.device_id || getDefaultDevice();
      if (!device) throw new Error("No device available");
      const output = args.output || path.join(os.tmpdir(), `screenshot_${Date.now()}.png`);
      const file = await takeAdbScreenshot(device, output);
      return { success: true, file, source: "adb_fallback" };
    }
  }

  if (name === "maestro_hierarchy") {
    try {
      const result = await maestroClient.callTool("inspect_view_hierarchy", {
        device_id: args.device_id,
      });
      return result;
    } catch (error) {
      // Fallback to ADB
      const device = args.device_id || getDefaultDevice();
      if (!device) throw new Error("No device available");
      const elements = getAdbHierarchy(device);
      return { elements, count: elements.length, source: "adb_fallback" };
    }
  }

  if (name === "maestro_tap") {
    return await maestroClient.callTool("tap_on", {
      device_id: args.device_id,
      text: args.text,
      id: args.id,
      use_fuzzy_matching: args.fuzzy !== false,
      index: args.index,
    });
  }

  if (name === "maestro_tap_coordinates") {
    // Use run_flow for coordinate taps
    const flowYaml = `---\n- tapOn:\n    point: "${args.x},${args.y}"`;
    return await maestroClient.callTool("run_flow", {
      device_id: args.device_id,
      flow_yaml: flowYaml,
    });
  }

  if (name === "maestro_input_text") {
    return await maestroClient.callTool("input_text", {
      device_id: args.device_id,
      text: args.text,
    });
  }

  if (name === "maestro_back") {
    return await maestroClient.callTool("back", { device_id: args.device_id });
  }

  if (name === "maestro_launch_app") {
    return await maestroClient.callTool("launch_app", {
      device_id: args.device_id,
      appId: args.app_id,
    });
  }

  if (name === "maestro_stop_app") {
    return await maestroClient.callTool("stop_app", {
      device_id: args.device_id,
      appId: args.app_id,
    });
  }

  if (name === "maestro_run_flow") {
    return await maestroClient.callTool("run_flow", {
      device_id: args.device_id,
      flow_yaml: args.flow_yaml,
      env: args.env,
    });
  }

  if (name === "maestro_cheat_sheet") {
    return await maestroClient.callTool("cheat_sheet", {});
  }

  // ========== ADB Direct Tools ==========
  if (name === "adb_devices") {
    return { devices: getAdbDevices() };
  }

  if (name === "adb_screenshot") {
    const device = args.device || getDefaultDevice();
    if (!device) throw new Error("No device connected");
    const file = await takeAdbScreenshot(device, args.output);
    return { success: true, file, device };
  }

  if (name === "adb_hierarchy") {
    const device = args.device || getDefaultDevice();
    if (!device) throw new Error("No device connected");
    const elements = getAdbHierarchy(device);
    return {
      elements: elements.map((el) => ({
        text: el.text,
        id: el.id,
        center: el.center, // Most important for tapping!
        bounds: el.bounds,
        clickable: el.clickable,
      })),
      count: elements.length,
      tip: "Use 'center' coordinates with adb_tap for clicking elements",
    };
  }

  if (name === "adb_find_element") {
    const device = args.device || getDefaultDevice();
    if (!device) throw new Error("No device connected");
    const elements = getAdbHierarchy(device);
    const matches = findElements(elements, { text: args.text, id: args.id, fuzzy: true });

    if (matches.length === 0) {
      return { found: false, error: `No element found matching text="${args.text}" id="${args.id}"` };
    }

    const index = args.index || 0;
    if (index >= matches.length) {
      return { found: false, error: `Index ${index} out of range (${matches.length} matches found)` };
    }

    const el = matches[index];
    return {
      found: true,
      element: {
        text: el.text,
        id: el.id,
        center: el.center,
        bounds: el.bounds,
      },
      tap_command: `adb_tap with x=${el.center.x}, y=${el.center.y}`,
      total_matches: matches.length,
    };
  }

  if (name === "adb_tap") {
    const device = args.device || getDefaultDevice();
    if (!device) throw new Error("No device connected");
    runAdb(["-s", device, "shell", "input", "tap", String(args.x), String(args.y)]);
    return { success: true, x: args.x, y: args.y };
  }

  if (name === "adb_tap_element") {
    const device = args.device || getDefaultDevice();
    if (!device) throw new Error("No device connected");
    const elements = getAdbHierarchy(device);
    const matches = findElements(elements, { text: args.text, id: args.id, fuzzy: true });

    if (matches.length === 0) {
      return { success: false, error: `No element found matching text="${args.text}" id="${args.id}"` };
    }

    const index = args.index || 0;
    const el = matches[index];
    runAdb(["-s", device, "shell", "input", "tap", String(el.center.x), String(el.center.y)]);

    return {
      success: true,
      tapped: { text: el.text, id: el.id, center: el.center },
    };
  }

  if (name === "adb_input_text") {
    const device = args.device || getDefaultDevice();
    if (!device) throw new Error("No device connected");
    // Escape special characters for ADB
    const escaped = args.text
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/ /g, "%s")
      .replace(/&/g, "\\&")
      .replace(/</g, "\\<")
      .replace(/>/g, "\\>")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/\|/g, "\\|")
      .replace(/;/g, "\\;")
      .replace(/\$/g, "\\$");
    runAdb(["-s", device, "shell", "input", "text", `"${escaped}"`]);
    return { success: true, text: args.text };
  }

  if (name === "adb_press_key") {
    const device = args.device || getDefaultDevice();
    if (!device) throw new Error("No device connected");

    const keyMap: Record<string, string> = {
      back: "KEYCODE_BACK",
      home: "KEYCODE_HOME",
      enter: "KEYCODE_ENTER",
      tab: "KEYCODE_TAB",
      delete: "KEYCODE_DEL",
      escape: "KEYCODE_ESCAPE",
      menu: "KEYCODE_MENU",
      search: "KEYCODE_SEARCH",
      volume_up: "KEYCODE_VOLUME_UP",
      volume_down: "KEYCODE_VOLUME_DOWN",
      power: "KEYCODE_POWER",
    };

    const keycode = keyMap[args.key] || `KEYCODE_${args.key.toUpperCase()}`;
    runAdb(["-s", device, "shell", "input", "keyevent", keycode]);
    return { success: true, key: args.key };
  }

  if (name === "adb_swipe") {
    const device = args.device || getDefaultDevice();
    if (!device) throw new Error("No device connected");

    // Get screen size for default center
    const sizeResult = runAdb(["-s", device, "shell", "wm", "size"]);
    const sizeMatch = sizeResult.stdout.match(/(\d+)x(\d+)/);
    const screenWidth = sizeMatch ? parseInt(sizeMatch[1]) : 1080;
    const screenHeight = sizeMatch ? parseInt(sizeMatch[2]) : 2400;

    const startX = args.start_x ?? Math.round(screenWidth / 2);
    const startY = args.start_y ?? Math.round(screenHeight / 2);
    const distance = args.distance || 500;
    const duration = args.duration || 300;

    let endX = startX, endY = startY;
    switch (args.direction) {
      case "up": endY = startY - distance; break;
      case "down": endY = startY + distance; break;
      case "left": endX = startX - distance; break;
      case "right": endX = startX + distance; break;
    }

    runAdb(["-s", device, "shell", "input", "swipe",
      String(startX), String(startY), String(endX), String(endY), String(duration)]);
    return { success: true, from: { x: startX, y: startY }, to: { x: endX, y: endY } };
  }

  if (name === "adb_launch_app") {
    const device = args.device || getDefaultDevice();
    if (!device) throw new Error("No device connected");

    let cmdArgs = ["-s", device, "shell", "am", "start"];
    if (args.uri) {
      cmdArgs.push("-a", "android.intent.action.VIEW", "-d", args.uri);
    }
    if (args.activity) {
      cmdArgs.push("-n", `${args.package}/${args.activity}`);
    } else {
      cmdArgs.push(args.package);
    }

    const result = runAdb(cmdArgs);
    return { success: result.code === 0, output: result.stdout, error: result.stderr };
  }

  if (name === "adb_shell") {
    const device = args.device || getDefaultDevice();
    if (!device) throw new Error("No device connected");
    const result = runAdb(["-s", device, "shell", args.command]);
    return { stdout: result.stdout, stderr: result.stderr, code: result.code };
  }

  throw new Error(`Unknown tool: ${name}`);
}

// ============================================================================
// Server Setup
// ============================================================================

const server = new Server(
  { name: "maestro-mcp-server", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const startTime = Date.now();
  try {
    const result = await handleToolCall(request.params.name, request.params.arguments || {});
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ ...result, _duration_ms: Date.now() - startTime }, null, 2),
      }],
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: errorMsg,
          tool: request.params.name,
          args: request.params.arguments,
          _duration_ms: Date.now() - startTime,
          suggestion: errorMsg.includes("device")
            ? "Run adb_devices to check connected devices"
            : errorMsg.includes("element")
            ? "Run adb_hierarchy to see available elements"
            : "Check tool arguments and try again",
        }, null, 2),
      }],
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
  console.error("Maestro MCP Server v2.0.0 running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

// Cleanup on exit
process.on("SIGINT", () => {
  maestroClient.stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  maestroClient.stop();
  process.exit(0);
});
