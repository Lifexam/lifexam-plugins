/** Build ChatGPT and Claude publication ZIPs from plugins/lifexam-eu/. */
import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  rename,
  utimes,
  stat,
  readdir,
  lstat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { SUPPORTED_LOCALES, type SupportedLocale } from "./locales";

const ROOT = process.cwd();
const PLUGIN_DIR = path.join(ROOT, "plugins", "lifexam-eu");
const PLUGIN_JSON_PATH = path.join(PLUGIN_DIR, "plugin.json");
const MCP_JSON_PATH = path.join(PLUGIN_DIR, "mcp.json");
const SKILL_PATH = path.join(
  PLUGIN_DIR,
  "skills",
  "lifexam-health-record",
  "SKILL.md",
);
const DIST_DIR = path.join(ROOT, "dist", "plugins");

const EXPECTED_MCP_URL = "https://eu.lifexam.com/api/mcp";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ASSETS: Array<{ source: string; dest: string; size: number }> = [
  {
    source: path.join(PLUGIN_DIR, "assets", "lifexam-icon.png"),
    dest: path.join("assets", "lifexam-icon.png"),
    size: 192,
  },
  {
    source: path.join(PLUGIN_DIR, "assets", "lifexam-logo.png"),
    dest: path.join("assets", "lifexam-logo.png"),
    size: 512,
  },
];

type ListingTranslation = { subtitle: string; description: string };

type PluginManifest = {
  name: string;
  version: string;
  description: string;
  author: { name: string };
  extensions: {
    "com.openai": {
      interface: {
        displayName: string;
        websiteURL: string;
        supportURL: string;
        privacyPolicyURL: string;
        termsOfServiceURL: string;
        logo: string;
      };
      publication: {
        countries: string[];
        release_notes: string;
        translations: Record<SupportedLocale, ListingTranslation>;
      };
    };
  };
};

type PluginPackage = {
  target: "chatgpt" | "claude";
  files: Map<string, Buffer>;
};

function fail(message: string): never {
  throw new Error(`plugin build failed: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertHttpsUrl(
  value: unknown,
  field: string,
): asserts value is string {
  if (!isNonEmptyString(value)) fail(`${field} must be a non-empty string`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    fail(`${field} must be a valid URL, got ${JSON.stringify(value)}`);
  }
  if (url.protocol !== "https:") fail(`${field} must use HTTPS`);
  if (/\s/.test(value) || url.username || url.password) {
    fail(`${field} must not embed credentials`);
  }
}

/** Listing copy is maintained alongside the plugin source. */
async function addListingTranslations(manifest: unknown) {
  if (!isRecord(manifest) || !isRecord(manifest.extensions)) {
    fail("plugin.json extensions are required");
  }
  const openai = manifest.extensions["com.openai"];
  if (
    !isRecord(openai) ||
    !isRecord(openai.interface) ||
    !isRecord(openai.publication)
  ) {
    fail("plugin.json OpenAI interface and publication are required");
  }
  const file = "plugins/lifexam-eu/translations.json";
  const listings: unknown = JSON.parse(
    await readFile(path.join(PLUGIN_DIR, "translations.json"), "utf8"),
  );
  const translations: Partial<Record<SupportedLocale, ListingTranslation>> = {};
  for (const locale of SUPPORTED_LOCALES) {
    const listing = isRecord(listings) ? listings[locale] : undefined;
    if (!isRecord(listing)) fail(`${file} must contain ${locale} listing copy`);
    for (const [key, max] of [
      ["subtitle", 30],
      ["description", 4000],
    ] as const) {
      const value = listing[key];
      if (
        !isNonEmptyString(value) ||
        value.length > max ||
        [...value].some((character) => {
          const code = character.charCodeAt(0);
          return (code < 32 && code !== 10) || code === 127;
        }) ||
        (key === "subtitle" && /[\r\n]/.test(value))
      ) {
        fail(
          `${file} ${locale}.${key} must be nonblank, at most ${max} characters, and contain no unsupported control characters`,
        );
      }
    }
    translations[locale] = {
      subtitle: listing.subtitle as string,
      description: listing.description as string,
    };
  }
  openai.interface.shortDescription = translations.en!.subtitle;
  openai.interface.longDescription = translations.en!.description;
  openai.publication.translations = translations;
}

function validatePluginManifest(
  manifest: unknown,
): asserts manifest is PluginManifest {
  if (!isRecord(manifest)) fail("plugin.json must be a JSON object");
  if (manifest.name !== "lifexam-eu") {
    fail(
      `plugin.json name must stay "lifexam-eu" to update the existing plugin`,
    );
  }
  if (
    typeof manifest.version !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(manifest.version)
  ) {
    fail("plugin.json version must be semantic (e.g. 1.0.2)");
  }
  if (
    !isNonEmptyString(manifest.description) ||
    manifest.description.length > 500
  ) {
    fail(
      "plugin.json description must be 1-500 (Claude upload limit) characters",
    );
  }
  for (const field of ["skills", "mcpServers", "apps", "interface"]) {
    if (manifest[field] !== undefined)
      fail(`portable plugin.json must not declare ${field}`);
  }
  const author = manifest.author;
  if (!isRecord(author) || !isNonEmptyString(author.name)) {
    fail("plugin.json author.name is required");
  }

  const openai = isRecord(manifest.extensions)
    ? manifest.extensions["com.openai"]
    : undefined;
  if (!isRecord(openai)) fail("plugin.json extensions.com.openai is required");
  if (openai.apps !== undefined && openai.apps !== null)
    fail("public plugin uploads must not declare apps");
  const iface = openai.interface;
  if (!isRecord(iface))
    fail("plugin.json extensions.com.openai.interface is required");

  for (const [field, max] of [
    ["displayName", 30],
    ["shortDescription", 30],
    ["longDescription", 4000],
    ["developerName", 80],
  ] as const) {
    const value = iface[field];
    if (!isNonEmptyString(value) || value.length > max) {
      fail(`interface.${field} must be 1-${max} characters`);
    }
  }
  if (!isNonEmptyString(iface.category)) fail("interface.category is required");

  const prompts = iface.defaultPrompt;
  if (!Array.isArray(prompts) || prompts.length === 0 || prompts.length > 3) {
    fail("interface.defaultPrompt must list 1-3 starter prompts");
  }
  for (const prompt of prompts) {
    if (!isNonEmptyString(prompt) || prompt.length > 128) {
      fail("each interface.defaultPrompt entry must be 1-128 characters");
    }
  }

  for (const field of [
    "websiteURL",
    "supportURL",
    "privacyPolicyURL",
    "termsOfServiceURL",
  ]) {
    assertHttpsUrl(iface[field], `interface.${field}`);
  }
  if (iface.logo !== "assets/lifexam-logo.png") {
    fail('interface.logo must stay "assets/lifexam-logo.png"');
  }
  if (iface.composerIcon !== "assets/lifexam-icon.png") {
    fail('interface.composerIcon must stay "assets/lifexam-icon.png"');
  }

  const review = openai.review;
  if (!isRecord(review)) fail("extensions.com.openai.review is required");
  if (review.commerce !== false) fail("review.commerce must stay false");
  if (!isNonEmptyString(review.commerce_description)) {
    fail("review.commerce_description is required");
  }
  if (review.demo_recording_url !== undefined) {
    assertHttpsUrl(review.demo_recording_url, "review.demo_recording_url");
  }
  const cases = isRecord(review.test_cases) ? review.test_cases : undefined;
  if (!cases)
    fail("review.test_cases with 5 positive and 3 negative cases is required");
  const positive = cases.positive;
  const negative = cases.negative;
  if (!Array.isArray(positive) || positive.length !== 5) {
    fail("review.test_cases.positive must contain exactly 5 cases");
  }
  if (!Array.isArray(negative) || negative.length !== 3) {
    fail("review.test_cases.negative must contain exactly 3 cases");
  }
  for (const testCase of positive) {
    if (!isRecord(testCase)) fail("each positive test case must be an object");
    for (const field of [
      "description",
      "prompt",
      "tools_triggered",
      "expected_behavior",
    ]) {
      if (!isNonEmptyString(testCase[field])) {
        fail(`each positive test case needs ${field}`);
      }
    }
  }
  for (const testCase of negative) {
    if (!isRecord(testCase)) fail("each negative test case must be an object");
    for (const field of ["description", "prompt", "expected_behavior"]) {
      if (!isNonEmptyString(testCase[field])) {
        fail(`each negative test case needs ${field}`);
      }
    }
  }

  const publication = openai.publication;
  if (!isRecord(publication) || !isNonEmptyString(publication.release_notes)) {
    fail("extensions.com.openai.publication.release_notes is required");
  }
  const countries = publication.countries;
  if (
    !Array.isArray(countries) ||
    countries.length === 0 ||
    countries.some(
      (country) => typeof country !== "string" || !/^[A-Z]{2}$/.test(country),
    ) ||
    new Set(countries).size !== countries.length
  ) {
    fail(
      "publication.countries must contain a nonempty, unique list of uppercase two-letter country codes; explicit country targeting is required for this EU plugin",
    );
  }
}

function validateMcpManifest(manifest: unknown) {
  if (!isRecord(manifest)) fail("mcp.json must be a JSON object");
  const servers = manifest.mcpServers;
  if (!isRecord(servers)) fail("mcp.json mcpServers is required");
  const names = Object.keys(servers);
  if (names.length !== 1 || names[0] !== "lifexam-eu") {
    fail('mcp.json must declare exactly one server named "lifexam-eu"');
  }
  const server = servers["lifexam-eu"];
  if (!isRecord(server)) fail("mcp.json lifexam-eu server must be an object");
  if (Object.keys(server).some((key) => !["type", "url"].includes(key))) {
    fail(
      "mcp.json server supports only type and url; do not embed credentials or unsupported options",
    );
  }
  if (server.type !== "streamable-http") {
    fail('mcp.json lifexam-eu type must stay "streamable-http"');
  }
  if (server.url !== EXPECTED_MCP_URL) {
    fail(`mcp.json lifexam-eu url must stay ${EXPECTED_MCP_URL}`);
  }
}

function validateSkill(markdown: string) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match)
    fail("SKILL.md must start with YAML frontmatter between --- lines");
  const [, frontmatter, body] = match;
  if (!/^name:\s*lifexam-health-record\s*$/m.test(frontmatter)) {
    fail("SKILL.md frontmatter name must stay lifexam-health-record");
  }
  if (!/^description:\s*\S/m.test(frontmatter)) {
    fail("SKILL.md frontmatter description is required");
  }
  if (!body.trim()) fail("SKILL.md body must not be empty");
}

async function validatePng(source: string, expectedSize: number) {
  let info: { format?: string; width?: number; height?: number };
  try {
    info = await sharp(source).metadata();
  } catch {
    fail(`${path.relative(ROOT, source)} is not a readable PNG`);
  }
  if (info.format !== "png") fail(`${path.relative(ROOT, source)} must be PNG`);
  if (info.width !== expectedSize || info.height !== expectedSize) {
    fail(
      `${path.relative(ROOT, source)} must be ${expectedSize}x${expectedSize}, ` +
        `got ${info.width}x${info.height}`,
    );
  }
  if (expectedSize < 48) fail("plugin icons must be at least 48x48");
  const sizeBytes = (await stat(source)).size;
  if (sizeBytes > MAX_IMAGE_BYTES) {
    fail(`${path.relative(ROOT, source)} must be at most 5 MiB`);
  }
}

function parseArgs(argv: string[]) {
  const args: {
    version?: string;
    tag?: string;
    releaseNotes?: string;
    outDir: string;
    check: boolean;
    help: boolean;
  } = { outDir: DIST_DIR, check: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, ...parts] = argv[i].split("=");
    if (flag === "--check" && parts.length === 0) args.check = true;
    else if ((flag === "--help" || flag === "-h") && parts.length === 0)
      args.help = true;
    else if (
      ["--version", "--release-notes", "--out-dir", "--tag"].includes(flag)
    ) {
      const value = parts.length ? parts.join("=") : argv[++i];
      if (!value || value.startsWith("--") || !value.trim())
        fail(`${flag} needs a value`);
      if (flag === "--version") args.version = value;
      else if (flag === "--tag") args.tag = value;
      else if (flag === "--release-notes") args.releaseNotes = value;
      else args.outDir = path.resolve(ROOT, value);
    } else fail(`unknown argument: ${argv[i]} (see --help)`);
  }
  if (args.version !== undefined && !/^\d+\.\d+\.\d+$/.test(args.version)) {
    fail("--version must be semantic (e.g. 1.0.2)");
  }
  if (args.tag !== undefined && !/^v\d+\.\d+\.\d+$/.test(args.tag))
    fail("--tag must be a release tag such as v1.0.4");
  if (
    args.tag !== undefined &&
    (args.version !== undefined || args.releaseNotes !== undefined)
  )
    fail("--tag cannot update the version or release notes");
  if (
    (args.version !== undefined || args.releaseNotes !== undefined) &&
    args.check
  ) {
    fail("--version and --release-notes cannot be combined with --check");
  }
  const relativeOut = path.relative(PLUGIN_DIR, args.outDir);
  if (
    !relativeOut ||
    (!relativeOut.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeOut))
  ) {
    fail("--out-dir must be outside plugins/lifexam-eu/");
  }
  return args;
}

function printHelp() {
  console.log(
    [
      "Build both plugin ZIPs from plugins/lifexam-eu/.",
      "",
      "  pnpm plugins:build",
      '  pnpm plugins:build --version 1.0.2 --release-notes "What changed"',
      "  pnpm plugins:build --out-dir dist/custom-plugins",
      "  pnpm plugins:check",
      "  pnpm plugins:check --tag v1.0.4",
      "",
      "Outputs: lifexam-eu-chatgpt-<version>.zip and lifexam-eu-claude-<version>.zip.",
      "See plugins/README.md for upload instructions and publication requirements.",
    ].join("\n"),
  );
}

function jsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

async function createPackages(
  manifest: PluginManifest,
  mcp: unknown,
  skill: string,
): Promise<PluginPackage[]> {
  const common = new Map<string, Buffer>([
    ["skills/lifexam-health-record/SKILL.md", Buffer.from(skill)],
  ]);
  for (const name of ["README.md", "LICENSE"])
    common.set(name, await readFile(path.join(PLUGIN_DIR, name)));
  for (const asset of ASSETS)
    common.set(asset.dest, await readFile(asset.source));

  const iface = manifest.extensions["com.openai"].interface;
  const claudeManifest = {
    name: manifest.name,
    displayName: iface.displayName,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    homepage: iface.websiteURL,
    icon: `./${iface.logo}`,
    documentationUrl: iface.websiteURL,
    supportUrl: iface.supportURL,
    privacyPolicyUrl: iface.privacyPolicyURL,
    termsOfServiceUrl: iface.termsOfServiceURL,
  };
  // Claude calls Streamable HTTP "http" and discovers .mcp.json at the root.
  // The validated source has one remote server and no embedded credentials.
  const server = (mcp as { mcpServers: Record<string, { url: string }> })
    .mcpServers[manifest.name];
  return [
    {
      target: "chatgpt",
      files: new Map([
        ...common,
        ["plugin.json", jsonBytes(manifest)],
        ["mcp.json", jsonBytes(mcp)],
      ]),
    },
    {
      target: "claude",
      files: new Map([
        ...common,
        [".claude-plugin/plugin.json", jsonBytes(claudeManifest)],
        [
          ".mcp.json",
          jsonBytes({
            mcpServers: {
              [manifest.name]: { type: "http", url: server.url },
            },
          }),
        ],
      ]),
    },
  ];
}

function checkArchive(zipPath: string, files: Map<string, Buffer>) {
  let names: string[];
  try {
    names = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
      .trimEnd()
      .split("\n");
  } catch {
    fail(
      `cannot read ${zipPath}; build it first and ensure unzip is installed`,
    );
  }
  // Check inventory before reading any entry. Never extract a supplied archive.
  if (
    names.length !== files.size ||
    names.some((name) => !files.has(name)) ||
    new Set(names).size !== names.length
  ) {
    fail(`${zipPath} has an unexpected file inventory; run pnpm plugins:build`);
  }
  for (const [name, bytes] of files) {
    const existing = execFileSync("unzip", ["-p", zipPath, name], {
      maxBuffer: bytes.length + 1,
    });
    if (!bytes.equals(existing))
      fail(`${zipPath} is stale (${name}); run pnpm plugins:build`);
  }
  console.log(`Plugin ZIP is up to date: ${path.relative(ROOT, zipPath)}`);
}

/** Generated folders are committed so Claude can read a complete package. */
function packageDirectory(pkg: PluginPackage) {
  return path.join(ROOT, pkg.target, "lifexam-eu");
}

async function checkPackageDirectory(pkg: PluginPackage, compareBytes = true) {
  const root = packageDirectory(pkg);
  const names: string[] = [];
  async function visit(directory: string) {
    if ((await lstat(directory)).isSymbolicLink())
      fail(`generated package must not contain symbolic links: ${directory}`);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) names.push(path.relative(root, file));
      else fail(`generated package must contain regular files: ${file}`);
    }
  }
  await visit(root);
  if (
    (compareBytes && names.length !== pkg.files.size) ||
    names.some((name) => !pkg.files.has(name))
  )
    fail(`${pkg.target} generated package has an unexpected file inventory`);
  if (!compareBytes) return;
  for (const [name, bytes] of pkg.files) {
    if (!bytes.equals(await readFile(path.join(root, name))))
      fail(
        `${pkg.target} generated package is stale (${name}); run pnpm plugins:build`,
      );
  }
}

async function writePackageDirectory(pkg: PluginPackage) {
  const root = packageDirectory(pkg);
  try {
    if ((await lstat(path.dirname(root))).isSymbolicLink())
      fail(`generated package parent must not be a symbolic link: ${root}`);
    await checkPackageDirectory(pkg, false);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  for (const [name, bytes] of pkg.files) {
    const dest = path.join(root, name);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, bytes);
  }
  await checkPackageDirectory(pkg);
}

async function buildArchive(
  stage: string,
  zipPath: string,
  files: Map<string, Buffer>,
) {
  const names = [...files.keys()].sort();
  for (const name of names) {
    const dest = path.join(stage, name);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, files.get(name)!);
    // Stable ZIP timestamps make repeated builds byte-identical.
    const timestamp = new Date("2000-01-01T00:00:00Z");
    await utimes(dest, timestamp, timestamp);
  }
  execFileSync("zip", ["-q", "-X", zipPath, ...names], {
    cwd: stage,
    stdio: "pipe",
    env: { ...process.env, TZ: "UTC" },
  });
  checkArchive(zipPath, files);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  const pluginRaw = await readFile(PLUGIN_JSON_PATH, "utf8");
  const manifest: unknown = JSON.parse(pluginRaw);
  const mcp: unknown = JSON.parse(await readFile(MCP_JSON_PATH, "utf8"));
  const skill = await readFile(SKILL_PATH, "utf8");

  // Generate listing metadata without duplicating translated copy in plugin.json.
  await addListingTranslations(manifest);
  // Validate before changing the source; failed builds must not bump versions.
  validatePluginManifest(manifest);
  if (args.tag !== undefined && args.tag !== `v${manifest.version}`)
    fail(
      `release tag ${args.tag} must match package version v${manifest.version}`,
    );
  if (args.version !== undefined) manifest.version = args.version;
  if (args.releaseNotes !== undefined)
    manifest.extensions["com.openai"].publication.release_notes =
      args.releaseNotes;
  validatePluginManifest(manifest);
  validateMcpManifest(mcp);
  validateSkill(skill);
  for (const asset of ASSETS) await validatePng(asset.source, asset.size);
  const packages = await createPackages(manifest, mcp, skill);
  const archiveName = (target: string) =>
    `${manifest.name}-${target}-${manifest.version}.zip`;

  if (args.check) {
    for (const pkg of packages) {
      checkArchive(path.join(args.outDir, archiveName(pkg.target)), pkg.files);
      await checkPackageDirectory(pkg);
    }
    return;
  }

  const workdir = await mkdtemp(path.join(os.tmpdir(), "lifexam-plugins-"));
  try {
    // Build and verify both before replacing either published output.
    for (const pkg of packages) {
      await buildArchive(
        path.join(workdir, pkg.target),
        path.join(workdir, archiveName(pkg.target)),
        pkg.files,
      );
    }
    await mkdir(args.outDir, { recursive: true });
    for (const pkg of packages) {
      // Copy through a sibling temporary file so replacing an existing ZIP is atomic,
      // including when the output directory is on another filesystem.
      const dest = path.join(args.outDir, archiveName(pkg.target));
      const temp = `${dest}.${path.basename(workdir)}.tmp`;
      try {
        await writeFile(
          temp,
          await readFile(path.join(workdir, archiveName(pkg.target))),
        );
        await rename(temp, dest);
      } finally {
        await rm(temp, { force: true });
      }
      console.log(`Built ${path.relative(ROOT, dest)}`);
    }
    for (const pkg of packages) await writePackageDirectory(pkg);
    if (args.version !== undefined || args.releaseNotes !== undefined) {
      // Persist release changes to the template, not generated listing fields.
      const source = JSON.parse(pluginRaw) as PluginManifest;
      source.version = manifest.version;
      source.extensions["com.openai"].publication.release_notes =
        manifest.extensions["com.openai"].publication.release_notes;
      await writeFile(PLUGIN_JSON_PATH, jsonBytes(source));
      console.log(
        `Updated plugins/lifexam-eu/plugin.json (${manifest.version})`,
      );
    }
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
