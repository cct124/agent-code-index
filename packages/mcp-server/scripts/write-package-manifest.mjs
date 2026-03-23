import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(scriptDir, "..");
const repoRoot = resolve(packageDir, "..", "..");
const outputDir = join(packageDir, "package-dist");

mkdirSync(outputDir, { recursive: true });

const mcpPackage = JSON.parse(
  readFileSync(join(packageDir, "package.json"), "utf8"),
);
const infraPackage = JSON.parse(
  readFileSync(join(repoRoot, "packages/infra/package.json"), "utf8"),
);

const publishedDependencies = {
  ...filterPublishedDependencies(mcpPackage.dependencies),
  ...filterPublishedDependencies(infraPackage.dependencies),
};

const publishedManifest = {
  name: mcpPackage.name,
  version: mcpPackage.version,
  description: mcpPackage.description,
  type: mcpPackage.type,
  private: false,
  main: "./index.js",
  files: ["index.js", "cli.js", "README.md", "LICENSE"],
  bin: {
    "agent-code-index-mcp": "./cli.js",
  },
  exports: {
    ".": {
      default: "./index.js",
    },
  },
  keywords: mcpPackage.keywords,
  license: mcpPackage.license,
  homepage: mcpPackage.homepage,
  repository: mcpPackage.repository,
  bugs: mcpPackage.bugs,
  publishConfig: mcpPackage.publishConfig,
  engines: mcpPackage.engines,
  dependencies: publishedDependencies,
};

writeFileSync(
  join(outputDir, "package.json"),
  `${JSON.stringify(publishedManifest, null, 2)}\n`,
  "utf8",
);

cpSync(join(packageDir, "README.md"), join(outputDir, "README.md"));
cpSync(join(repoRoot, "LICENSE"), join(outputDir, "LICENSE"));

function filterPublishedDependencies(dependencies = {}) {
  return Object.fromEntries(
    Object.entries(dependencies).filter(
      ([packageName]) => !packageName.startsWith("@agent-code-index/"),
    ),
  );
}
