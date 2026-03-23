import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

syncMcpServerVersion();

function syncMcpServerVersion() {
  const packageJsonPath = join(
    repoRoot,
    "packages",
    "mcp-server",
    "package.json",
  );
  const serverSourcePath = join(
    repoRoot,
    "packages",
    "mcp-server",
    "src",
    "server.ts",
  );

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const nextVersion = packageJson.version;
  const serverSource = readFileSync(serverSourcePath, "utf8");
  const versionPattern = /const SERVER_VERSION = "([^"]+)";/;
  const match = serverSource.match(versionPattern);

  if (!match) {
    throw new Error(
      "Unable to find SERVER_VERSION declaration in packages/mcp-server/src/server.ts",
    );
  }

  const currentVersion = match[1];

  if (currentVersion === nextVersion) {
    console.log(
      `MCP server source version already synchronized at ${nextVersion}`,
    );
    return;
  }

  const updatedSource = serverSource.replace(
    versionPattern,
    `const SERVER_VERSION = "${nextVersion}";`,
  );

  writeFileSync(serverSourcePath, updatedSource, "utf8");
  console.log(`Synchronized MCP server source version to ${nextVersion}`);
}
