import { execFileSync } from "node:child_process";
import { accessSync, constants, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const packageDir = resolve(scriptDir, "..");
const packageJsonPath = join(packageDir, "package.json");
const packageDistJsonPath = join(packageDir, "package-dist", "package.json");
const serverSourcePath = join(packageDir, "src", "server.ts");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const packageDistJson = readJsonIfExists(packageDistJsonPath);
const serverSource = readFileSync(serverSourcePath, "utf8");
const serverVersion = extractServerVersion(serverSource);

if (serverVersion !== packageJson.version) {
  throw new Error(
    `Version mismatch: packages/mcp-server/package.json=${packageJson.version}, src/server.ts=${serverVersion}`,
  );
}

if (!packageDistJson) {
  throw new Error(
    "Missing package-dist/package.json. Run yarn workspace @agent-code-index/mcp-server build:package first.",
  );
}

if (packageDistJson.version !== packageJson.version) {
  throw new Error(
    `Version mismatch: package-dist/package.json=${packageDistJson.version}, packages/mcp-server/package.json=${packageJson.version}`,
  );
}

const packDryRunOutput = execFileSync("npm", ["pack", "--dry-run"], {
  cwd: join(packageDir, "package-dist"),
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

console.log(
  JSON.stringify(
    {
      ok: true,
      version: packageJson.version,
      checks: [
        "package.json matches src/server.ts",
        "package-dist/package.json matches package.json",
        "package-dist npm pack --dry-run passed",
      ],
      packDryRunSummary: summarizePackOutput(packDryRunOutput),
    },
    null,
    2,
  ),
);

function extractServerVersion(source) {
  const match = source.match(/const SERVER_VERSION = "([^"]+)";/);

  if (!match) {
    throw new Error("Unable to find SERVER_VERSION in src/server.ts");
  }

  return match[1];
}

function readJsonIfExists(filePath) {
  try {
    accessSync(filePath, constants.F_OK);
  } catch {
    return null;
  }

  return JSON.parse(readFileSync(filePath, "utf8"));
}

function summarizePackOutput(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        line.startsWith("npm notice name:") ||
        line.startsWith("npm notice version:") ||
        line.startsWith("npm notice total files:") ||
        line.endsWith(".tgz"),
    );
}
