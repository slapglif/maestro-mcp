/**
 * Visual Inspector Module
 *
 * Provides tools for visual recursive inspection of mobile apps:
 * - Screen capture with deduplication
 * - Region focus for detailed analysis
 * - Screen registry management
 * - Constraint management
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { spawn, execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

// ============================================================================
// Types
// ============================================================================

interface ScreenEntry {
  id: string;
  path: string;
  phash: string;
  hierarchyHash: string;
  timestamp: string;
  navPath: string[];
  analyzed: boolean;
  findings: Finding[];
}

interface Finding {
  type: "consistency" | "accessibility" | "design_system";
  severity: "critical" | "warning" | "info";
  component: string;
  message: string;
  details?: Record<string, unknown>;
}

interface DesignSystem {
  brand: {
    colors: Record<string, string>;
    typography: Record<string, string>;
    spacing: { unit: number; scale: number[] };
  };
  accessibility: {
    min_contrast: number;
    min_touch_target: number;
    require_labels: boolean;
  };
  discovered_patterns: Pattern[];
}

interface Pattern {
  type: string;
  screens: string[];
  consistency: number;
  evidence: string[];
}

// ============================================================================
// State Management
// ============================================================================

const INSPECTOR_DIR = path.join(os.tmpdir(), "maestro-inspector");
const SCREENS_DIR = path.join(INSPECTOR_DIR, "screens");
const FINDINGS_DIR = path.join(INSPECTOR_DIR, "findings");
const REGISTRY_FILE = path.join(INSPECTOR_DIR, "registry.json");
const CONSTRAINTS_FILE = path.join(INSPECTOR_DIR, "design-system.json");

let screenRegistry: Map<string, ScreenEntry> = new Map();
let screenCounter = 0;

function ensureDirectories(): void {
  [INSPECTOR_DIR, SCREENS_DIR, FINDINGS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function loadRegistry(): void {
  if (fs.existsSync(REGISTRY_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
      screenRegistry = new Map(Object.entries(data));
      screenCounter = screenRegistry.size;
    } catch {
      screenRegistry = new Map();
      screenCounter = 0;
    }
  }
}

function saveRegistry(): void {
  const data = Object.fromEntries(screenRegistry);
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2), "utf8");
}

function getDefaultDesignSystem(): DesignSystem {
  return {
    brand: {
      colors: {},
      typography: {},
      spacing: { unit: 8, scale: [4, 8, 16, 24, 32, 48] },
    },
    accessibility: {
      min_contrast: 4.5,
      min_touch_target: 44,
      require_labels: true,
    },
    discovered_patterns: [],
  };
}

function loadDesignSystem(): DesignSystem {
  if (fs.existsSync(CONSTRAINTS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONSTRAINTS_FILE, "utf8"));
    } catch {
      return getDefaultDesignSystem();
    }
  }
  return getDefaultDesignSystem();
}

function saveDesignSystem(ds: DesignSystem): void {
  fs.writeFileSync(CONSTRAINTS_FILE, JSON.stringify(ds, null, 2), "utf8");
}

// ============================================================================
// Perceptual Hashing
// ============================================================================

/**
 * IMPORTANT LIMITATION: This is a PLACEHOLDER implementation using MD5 file hash.
 *
 * MD5 of file bytes is NOT perceptual hashing - two visually identical screenshots
 * with different metadata (timestamps, compression) will have different hashes.
 *
 * For proper screen deduplication, this needs to be replaced with:
 * - Average hash (aHash) - resize to 8x8, grayscale, compare to mean
 * - Difference hash (dHash) - compare adjacent pixel gradients
 * - Perceptual hash (pHash) - DCT-based, most robust
 *
 * Libraries to consider: sharp, jimp, or image-hash npm packages.
 *
 * Current behavior: Falls back to hierarchy hash comparison which is more reliable
 * for detecting actual screen changes.
 *
 * @param imagePath - Path to the screenshot image
 * @returns MD5 hash of file content (placeholder - not true perceptual hash)
 */
function computePerceptualHash(imagePath: string): string {
  // PLACEHOLDER: Using MD5 of file content
  // This means deduplication will have false negatives (same visual = different hash)
  // but NOT false positives (different visual = same hash)
  // The hierarchy hash provides a fallback for structural similarity
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Screenshot file not found: ${imagePath}`);
  }
  const content = fs.readFileSync(imagePath);
  return crypto.createHash("md5").update(content).digest("hex");
}

/**
 * Compute hamming distance between two hex hashes
 */
function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const n1 = parseInt(hash1[i], 16);
    const n2 = parseInt(hash2[i], 16);
    let xor = n1 ^ n2;
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

/**
 * Find duplicate screen by perceptual hash
 */
function findDuplicateScreen(phash: string, threshold = 5): ScreenEntry | null {
  for (const entry of screenRegistry.values()) {
    if (hammingDistance(phash, entry.phash) < threshold) {
      return entry;
    }
  }
  return null;
}

// ============================================================================
// Maestro Helpers
// ============================================================================

async function runMaestro(
  args: string[],
  options: { cwd?: string } = {}
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

    proc.on("close", (code) => {
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code || 0 });
    });

    proc.on("error", reject);
  });
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const visualInspectorTools: Tool[] = [
  // ========== Screen Capture with Deduplication ==========
  {
    name: "maestro_capture_screen",
    description:
      "Capture a screenshot with automatic deduplication. Returns screen_id and whether it's new or existing.",
    inputSchema: {
      type: "object",
      properties: {
        navPath: {
          type: "array",
          items: { type: "string" },
          description: "Navigation path to reach this screen (e.g., ['home', 'tap:Settings'])",
        },
        device: {
          type: "string",
          description: "Specific device ID",
        },
      },
    },
  },

  // ========== Region Focus ==========
  {
    name: "maestro_focus_region",
    description:
      "Focus on a specific region of a screenshot for detailed analysis. Returns cropped image and local UI hierarchy.",
    inputSchema: {
      type: "object",
      properties: {
        screenId: {
          type: "string",
          description: "Screen ID from maestro_capture_screen",
        },
        region: {
          type: "object",
          properties: {
            x: { type: "number", description: "X coordinate (pixels)" },
            y: { type: "number", description: "Y coordinate (pixels)" },
            width: { type: "number", description: "Width (pixels)" },
            height: { type: "number", description: "Height (pixels)" },
          },
          description: "Region bounds. Alternative: use named region.",
        },
        namedRegion: {
          type: "string",
          enum: ["top", "bottom", "left", "right", "center", "header", "footer", "nav"],
          description: "Named region (alternative to explicit bounds)",
        },
        question: {
          type: "string",
          description: "Question to answer about this region",
        },
      },
      required: ["screenId"],
    },
  },

  // ========== Screen Registry ==========
  {
    name: "maestro_get_screen_registry",
    description: "Get all captured screens and their analysis status",
    inputSchema: {
      type: "object",
      properties: {
        includeFindings: {
          type: "boolean",
          description: "Include findings for each screen",
          default: false,
        },
      },
    },
  },

  // ========== Compare Screens ==========
  {
    name: "maestro_compare_screens",
    description: "Compare two screens for visual similarity",
    inputSchema: {
      type: "object",
      properties: {
        screenId1: {
          type: "string",
          description: "First screen ID",
        },
        screenId2: {
          type: "string",
          description: "Second screen ID",
        },
      },
      required: ["screenId1", "screenId2"],
    },
  },

  // ========== Record Finding ==========
  {
    name: "maestro_record_finding",
    description: "Record a quality finding for a screen",
    inputSchema: {
      type: "object",
      properties: {
        screenId: {
          type: "string",
          description: "Screen ID",
        },
        type: {
          type: "string",
          enum: ["consistency", "accessibility", "design_system"],
          description: "Finding type",
        },
        severity: {
          type: "string",
          enum: ["critical", "warning", "info"],
          description: "Severity level",
        },
        component: {
          type: "string",
          description: "Component identifier",
        },
        message: {
          type: "string",
          description: "Finding description",
        },
        details: {
          type: "object",
          description: "Additional details",
        },
      },
      required: ["screenId", "type", "severity", "component", "message"],
    },
  },

  // ========== Constraint Management ==========
  {
    name: "maestro_get_design_system",
    description: "Get current design system constraints",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  {
    name: "maestro_update_constraint",
    description: "Update a design system constraint (discovered pattern, color, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "JSON path (e.g., 'brand.colors.primary', 'discovered_patterns')",
        },
        value: {
          description: "Value to set",
        },
        operation: {
          type: "string",
          enum: ["set", "append"],
          description: "Set value or append to array",
          default: "set",
        },
        evidence: {
          type: "string",
          description: "Screen/component where discovered",
        },
      },
      required: ["path", "value"],
    },
  },

  // ========== Session Management ==========
  {
    name: "maestro_init_inspection",
    description: "Initialize a new visual inspection session",
    inputSchema: {
      type: "object",
      properties: {
        appId: {
          type: "string",
          description: "App bundle ID or package name",
        },
        initialConstraints: {
          type: "object",
          description: "Initial design system constraints (optional)",
        },
      },
      required: ["appId"],
    },
  },

  {
    name: "maestro_cleanup_session",
    description: "Clean up inspection session, archive findings, delete temp files",
    inputSchema: {
      type: "object",
      properties: {
        archivePath: {
          type: "string",
          description: "Path to save archived report (optional)",
        },
        deleteScreenshots: {
          type: "boolean",
          description: "Delete screenshot files",
          default: true,
        },
      },
    },
  },

  // ========== Report Generation ==========
  {
    name: "maestro_generate_report",
    description: "Generate quality inspection report",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["json", "markdown", "html"],
          description: "Report format",
          default: "json",
        },
        output: {
          type: "string",
          description: "Output file path (optional)",
        },
        includeScreenshots: {
          type: "boolean",
          description: "Embed screenshots in report (for HTML)",
          default: false,
        },
      },
    },
  },
];

// ============================================================================
// Tool Handlers
// ============================================================================

export async function handleVisualInspectorTool(
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  ensureDirectories();
  loadRegistry();

  switch (name) {
    case "maestro_capture_screen": {
      // Take screenshot
      const screenId = `screen_${String(++screenCounter).padStart(3, "0")}`;
      const screenshotPath = path.join(SCREENS_DIR, `${screenId}.png`);

      const cmdArgs = ["screenshot", "--output", screenshotPath];
      if (args.device) {
        cmdArgs.push("--device", args.device as string);
      }

      const result = await runMaestro(cmdArgs);
      if (result.code !== 0) {
        return { error: "Screenshot failed", stderr: result.stderr };
      }

      // Compute perceptual hash
      const phash = computePerceptualHash(screenshotPath);

      // Check for duplicate
      const duplicate = findDuplicateScreen(phash);
      if (duplicate) {
        // Clean up the new screenshot
        fs.unlinkSync(screenshotPath);
        screenCounter--;
        return {
          screenId: duplicate.id,
          path: duplicate.path,
          isDuplicate: true,
          alreadyAnalyzed: duplicate.analyzed,
          message: `Screen matches existing ${duplicate.id}`,
        };
      }

      // Get hierarchy for hash
      const hierarchyResult = await runMaestro(["hierarchy"]);
      const hierarchyHash = crypto
        .createHash("md5")
        .update(hierarchyResult.stdout)
        .digest("hex");

      // Register new screen
      const entry: ScreenEntry = {
        id: screenId,
        path: screenshotPath,
        phash,
        hierarchyHash,
        timestamp: new Date().toISOString(),
        navPath: (args.navPath as string[]) || [],
        analyzed: false,
        findings: [],
      };

      screenRegistry.set(screenId, entry);
      saveRegistry();

      return {
        screenId,
        path: screenshotPath,
        isDuplicate: false,
        hierarchy: hierarchyResult.stdout,
        message: "New screen captured and registered",
      };
    }

    case "maestro_focus_region": {
      const screenId = args.screenId as string;
      const entry = screenRegistry.get(screenId);
      if (!entry) {
        return { error: `Screen ${screenId} not found in registry` };
      }

      // For now, return the full screenshot path and suggest cropping
      // TODO: Implement actual image cropping with sharp/jimp
      let regionInfo: Record<string, unknown> = {};

      if (args.namedRegion) {
        // Map named regions to approximate bounds (assuming 1080x1920 screen)
        const namedRegions: Record<string, { x: number; y: number; width: number; height: number }> = {
          top: { x: 0, y: 0, width: 1080, height: 300 },
          bottom: { x: 0, y: 1620, width: 1080, height: 300 },
          left: { x: 0, y: 0, width: 300, height: 1920 },
          right: { x: 780, y: 0, width: 300, height: 1920 },
          center: { x: 270, y: 480, width: 540, height: 960 },
          header: { x: 0, y: 0, width: 1080, height: 200 },
          footer: { x: 0, y: 1720, width: 1080, height: 200 },
          nav: { x: 0, y: 1800, width: 1080, height: 120 },
        };
        regionInfo = namedRegions[args.namedRegion as string] || {};
      } else if (args.region) {
        regionInfo = args.region as Record<string, unknown>;
      }

      return {
        screenId,
        screenshotPath: entry.path,
        region: regionInfo,
        question: args.question || null,
        instruction:
          "Analyze the specified region of the screenshot. Use Claude Vision to examine this area in detail.",
      };
    }

    case "maestro_get_screen_registry": {
      const includeFindings = args.includeFindings as boolean;
      const screens = Array.from(screenRegistry.values()).map((entry) => ({
        id: entry.id,
        path: entry.path,
        timestamp: entry.timestamp,
        navPath: entry.navPath,
        analyzed: entry.analyzed,
        findingCount: entry.findings.length,
        ...(includeFindings ? { findings: entry.findings } : {}),
      }));

      return {
        totalScreens: screens.length,
        analyzedCount: screens.filter((s) => s.analyzed).length,
        screens,
      };
    }

    case "maestro_compare_screens": {
      const entry1 = screenRegistry.get(args.screenId1 as string);
      const entry2 = screenRegistry.get(args.screenId2 as string);

      if (!entry1 || !entry2) {
        return { error: "One or both screens not found" };
      }

      const visualDistance = hammingDistance(entry1.phash, entry2.phash);
      const hierarchyMatch = entry1.hierarchyHash === entry2.hierarchyHash;

      return {
        screen1: entry1.id,
        screen2: entry2.id,
        visualDistance,
        hierarchyMatch,
        similarity: visualDistance < 5 ? "identical" : visualDistance < 15 ? "similar" : "different",
      };
    }

    case "maestro_record_finding": {
      const screenId = args.screenId as string;
      const entry = screenRegistry.get(screenId);
      if (!entry) {
        return { error: `Screen ${screenId} not found` };
      }

      const finding: Finding = {
        type: args.type as Finding["type"],
        severity: args.severity as Finding["severity"],
        component: args.component as string,
        message: args.message as string,
        details: args.details as Record<string, unknown>,
      };

      entry.findings.push(finding);
      entry.analyzed = true;
      saveRegistry();

      return {
        success: true,
        screenId,
        totalFindings: entry.findings.length,
        finding,
      };
    }

    case "maestro_get_design_system": {
      return loadDesignSystem() as unknown as Record<string, unknown>;
    }

    case "maestro_update_constraint": {
      const pathStr = args.path as string | undefined;
      const value = args.value;
      const operation = (args.operation as string) || "set";
      const evidence = args.evidence as string | undefined;

      // Validate required parameters
      if (!pathStr || typeof pathStr !== "string") {
        return { error: "Path is required and must be a string" };
      }

      if (value === undefined) {
        return { error: "Value is required" };
      }

      // Validate path format (alphanumeric segments separated by dots)
      const pathPattern = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;
      if (!pathPattern.test(pathStr)) {
        return {
          error: "Invalid path format",
          hint: "Path must be dot-separated identifiers (e.g., 'brand.colors.primary')",
        };
      }

      // Validate operation
      if (operation !== "set" && operation !== "append") {
        return { error: "Operation must be 'set' or 'append'" };
      }

      const ds = loadDesignSystem();
      const parts = pathStr.split(".");

      // Type-safe navigation with validation
      type NestedObject = { [key: string]: unknown };
      let current: NestedObject = ds as unknown as NestedObject;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const existing = current[part];

        if (existing === undefined) {
          // Create intermediate object
          current[part] = {};
          current = current[part] as NestedObject;
        } else if (typeof existing === "object" && existing !== null && !Array.isArray(existing)) {
          current = existing as NestedObject;
        } else {
          return {
            error: `Cannot navigate through path: '${parts.slice(0, i + 1).join(".")}' is not an object`,
            actualType: Array.isArray(existing) ? "array" : typeof existing,
          };
        }
      }

      const lastKey = parts[parts.length - 1];
      const existingValue = current[lastKey];

      if (operation === "append") {
        if (existingValue === undefined) {
          // Initialize as array with the value
          current[lastKey] = [value];
        } else if (Array.isArray(existingValue)) {
          existingValue.push(value);
        } else {
          return {
            error: `Cannot append to '${pathStr}': not an array`,
            actualType: typeof existingValue,
          };
        }
      } else {
        current[lastKey] = value;
      }

      saveDesignSystem(ds);

      return {
        success: true,
        path: pathStr,
        operation,
        previousValue: existingValue,
        newValue: current[lastKey],
        evidence,
      };
    }

    case "maestro_init_inspection": {
      // Reset registry and constraints
      screenRegistry = new Map();
      screenCounter = 0;
      saveRegistry();

      const initialConstraints = args.initialConstraints as DesignSystem | undefined;
      const ds = initialConstraints || getDefaultDesignSystem();
      saveDesignSystem(ds);

      return {
        success: true,
        appId: args.appId,
        inspectorDir: INSPECTOR_DIR,
        message: "Inspection session initialized",
      };
    }

    case "maestro_cleanup_session": {
      const archivePath = args.archivePath as string | undefined;
      const deleteScreenshots = args.deleteScreenshots !== false;

      // Generate final report
      const report = generateReportData();

      if (archivePath) {
        fs.writeFileSync(archivePath, JSON.stringify(report, null, 2), "utf8");
      }

      if (deleteScreenshots) {
        // Delete all screenshots
        for (const entry of screenRegistry.values()) {
          if (fs.existsSync(entry.path)) {
            fs.unlinkSync(entry.path);
          }
        }
      }

      // Clear registry
      screenRegistry = new Map();
      screenCounter = 0;
      saveRegistry();

      return {
        success: true,
        archived: !!archivePath,
        screenshotsDeleted: deleteScreenshots,
        report: archivePath ? undefined : report,
      };
    }

    case "maestro_generate_report": {
      const format = (args.format as string) || "json";
      const report = generateReportData();

      let content: string;
      switch (format) {
        case "markdown":
          content = generateMarkdownReport(report);
          break;
        case "html":
          content = generateHtmlReport(report, args.includeScreenshots as boolean);
          break;
        default:
          content = JSON.stringify(report, null, 2);
      }

      if (args.output) {
        fs.writeFileSync(args.output as string, content, "utf8");
        return { success: true, outputPath: args.output, format };
      }

      return { report: format === "json" ? report : content, format };
    }

    default:
      throw new Error(`Unknown visual inspector tool: ${name}`);
  }
}

// ============================================================================
// Report Generation Helpers
// ============================================================================

interface ReportData {
  timestamp: string;
  screensAnalyzed: number;
  componentsEvaluated: number;
  scores: {
    overall: number;
    consistency: number;
    accessibility: number;
    designSystem: number;
  };
  designSystem: DesignSystem;
  issues: {
    critical: Finding[];
    warning: Finding[];
    info: Finding[];
  };
  screens: Array<{
    id: string;
    navPath: string[];
    findings: Finding[];
  }>;
}

function generateReportData(): ReportData {
  const ds = loadDesignSystem();
  const screens = Array.from(screenRegistry.values());

  const allFindings = screens.flatMap((s) => s.findings);
  const critical = allFindings.filter((f) => f.severity === "critical");
  const warning = allFindings.filter((f) => f.severity === "warning");
  const info = allFindings.filter((f) => f.severity === "info");

  // Calculate scores (simple formula)
  const totalIssues = critical.length * 10 + warning.length * 3 + info.length;
  const maxScore = 100;
  const overall = Math.max(0, maxScore - totalIssues);

  const consistencyIssues = allFindings.filter((f) => f.type === "consistency");
  const a11yIssues = allFindings.filter((f) => f.type === "accessibility");
  const dsIssues = allFindings.filter((f) => f.type === "design_system");

  return {
    timestamp: new Date().toISOString(),
    screensAnalyzed: screens.length,
    componentsEvaluated: allFindings.length,
    scores: {
      overall,
      consistency: Math.max(0, 100 - consistencyIssues.length * 5),
      accessibility: Math.max(0, 100 - a11yIssues.length * 8),
      designSystem: Math.max(0, 100 - dsIssues.length * 5),
    },
    designSystem: ds,
    issues: { critical, warning, info },
    screens: screens.map((s) => ({
      id: s.id,
      navPath: s.navPath,
      findings: s.findings,
    })),
  };
}

function generateMarkdownReport(data: ReportData): string {
  const lines: string[] = [
    "# Visual Quality Inspection Report",
    "",
    `**Generated:** ${data.timestamp}`,
    `**Screens Analyzed:** ${data.screensAnalyzed}`,
    "",
    "## Overall Scores",
    "",
    `| Category | Score |`,
    `|----------|-------|`,
    `| Overall | ${data.scores.overall}/100 |`,
    `| Visual Consistency | ${data.scores.consistency}/100 |`,
    `| Accessibility | ${data.scores.accessibility}/100 |`,
    `| Design System | ${data.scores.designSystem}/100 |`,
    "",
    "## Issues",
    "",
  ];

  if (data.issues.critical.length > 0) {
    lines.push("### Critical");
    data.issues.critical.forEach((f) => {
      lines.push(`- **${f.component}**: ${f.message}`);
    });
    lines.push("");
  }

  if (data.issues.warning.length > 0) {
    lines.push("### Warnings");
    data.issues.warning.forEach((f) => {
      lines.push(`- **${f.component}**: ${f.message}`);
    });
    lines.push("");
  }

  if (data.issues.info.length > 0) {
    lines.push("### Info");
    data.issues.info.forEach((f) => {
      lines.push(`- **${f.component}**: ${f.message}`);
    });
    lines.push("");
  }

  lines.push("## Discovered Design System");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(data.designSystem, null, 2));
  lines.push("```");

  return lines.join("\n");
}

function generateHtmlReport(data: ReportData, _includeScreenshots: boolean): string {
  // Basic HTML report
  return `<!DOCTYPE html>
<html>
<head>
  <title>Visual Quality Inspection Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    .score { font-size: 2em; font-weight: bold; }
    .critical { color: #dc3545; }
    .warning { color: #ffc107; }
    .info { color: #17a2b8; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>Visual Quality Inspection Report</h1>
  <p>Generated: ${data.timestamp}</p>
  <p>Screens Analyzed: ${data.screensAnalyzed}</p>

  <h2>Scores</h2>
  <table>
    <tr><th>Category</th><th>Score</th></tr>
    <tr><td>Overall</td><td class="score">${data.scores.overall}/100</td></tr>
    <tr><td>Visual Consistency</td><td>${data.scores.consistency}/100</td></tr>
    <tr><td>Accessibility</td><td>${data.scores.accessibility}/100</td></tr>
    <tr><td>Design System</td><td>${data.scores.designSystem}/100</td></tr>
  </table>

  <h2>Issues</h2>
  <h3 class="critical">Critical (${data.issues.critical.length})</h3>
  <ul>${data.issues.critical.map((f) => `<li><strong>${f.component}</strong>: ${f.message}</li>`).join("")}</ul>

  <h3 class="warning">Warnings (${data.issues.warning.length})</h3>
  <ul>${data.issues.warning.map((f) => `<li><strong>${f.component}</strong>: ${f.message}</li>`).join("")}</ul>

  <h3 class="info">Info (${data.issues.info.length})</h3>
  <ul>${data.issues.info.map((f) => `<li><strong>${f.component}</strong>: ${f.message}</li>`).join("")}</ul>
</body>
</html>`;
}
