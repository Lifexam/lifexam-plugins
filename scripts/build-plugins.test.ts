import { execFileSync } from "node:child_process";
import { randomFillSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";

const repoRoot = path.resolve(__dirname, "..");
const fixtures: string[] = [];
const sourceDir = "plugins/lifexam-eu";

// Isolate every test, including version updates and malformed source checks.
function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lifexam-plugin-test-"));
  fixtures.push(root);
  fs.cpSync(path.join(repoRoot, sourceDir), path.join(root, sourceDir), {
    recursive: true,
  });
  fs.cpSync(
    path.join(repoRoot, "claude/lifexam-eu"),
    path.join(root, "claude/lifexam-eu"),
    { recursive: true },
  );
  return root;
}

afterEach(() => {
  for (const root of fixtures.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

function runBuild(root: string, args: string[] = []) {
  return execFileSync(
    path.join(repoRoot, "node_modules/.bin/tsx"),
    [path.join(repoRoot, "scripts/build-plugins.ts"), ...args],
    { cwd: root, encoding: "utf8", stdio: "pipe" },
  );
}

function sourceManifest(root: string) {
  return JSON.parse(
    fs.readFileSync(path.join(root, sourceDir, "plugin.json"), "utf8"),
  );
}

function updateManifest(
  root: string,
  change: (manifest: ReturnType<typeof sourceManifest>) => void,
) {
  const manifest = sourceManifest(root);
  change(manifest);
  fs.writeFileSync(
    path.join(root, sourceDir, "plugin.json"),
    JSON.stringify(manifest, null, 2),
  );
}

function archive(
  root: string,
  target: "chatgpt" | "claude",
  version = sourceManifest(root).version,
) {
  if (target !== "chatgpt") return path.join(root, target, "lifexam-eu");
  return path.join(root, "dist/plugins", `lifexam-eu-${target}-${version}.zip`);
}

function entries(zip: string): string[] {
  if (fs.statSync(zip).isDirectory()) {
    return fs
      .readdirSync(zip, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) =>
        path.relative(zip, path.join(entry.parentPath, entry.name)),
      )
      .sort();
  }
  return execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" })
    .trim()
    .split("\n")
    .sort();
}

function readEntry(zip: string, name: string) {
  if (fs.statSync(zip).isDirectory())
    return fs.readFileSync(path.join(zip, name));
  return execFileSync("unzip", ["-p", zip, name], {
    maxBuffer: 5 * 1024 * 1024,
  });
}

function expectFailure(root: string, args: string[], message: string) {
  try {
    runBuild(root, args);
    expect.fail("Build unexpectedly succeeded");
  } catch (error) {
    const output = (error as { stderr?: Buffer }).stderr?.toString();
    expect(output).toContain(message);
  }
}

describe("plugin builds", () => {
  it("builds ChatGPT and validates repository packages with identical shared skill and icons", () => {
    const root = createFixture();
    runBuild(root);
    expect(fs.readdirSync(path.join(root, "dist/plugins"))).toEqual([
      `lifexam-eu-chatgpt-${sourceManifest(root).version}.zip`,
    ]);
    const chatgpt = archive(root, "chatgpt");
    const claude = archive(root, "claude");
    const common = [
      "skills/lifexam-health-record/SKILL.md",
      "assets/lifexam-icon.png",
      "assets/lifexam-logo.png",
      "README.md",
      "LICENSE",
    ];
    expect(entries(chatgpt)).toEqual(
      [...common, "plugin.json", "mcp.json"].sort(),
    );
    expect(entries(claude)).toEqual(
      [...common, ".claude-plugin/plugin.json", ".mcp.json"].sort(),
    );
    expect(
      JSON.parse(readEntry(chatgpt, "plugin.json").toString()),
    ).toMatchObject(sourceManifest(root));
    const manifest = sourceManifest(root);
    expect(
      JSON.parse(readEntry(claude, ".claude-plugin/plugin.json").toString()),
    ).toEqual({
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      displayName: "Lifexam EU",
      homepage: manifest.extensions["com.openai"].interface.websiteURL,
      icon: "./assets/lifexam-logo.png",
      documentationUrl: manifest.extensions["com.openai"].interface.websiteURL,
      supportUrl: manifest.extensions["com.openai"].interface.supportURL,
      privacyPolicyUrl:
        manifest.extensions["com.openai"].interface.privacyPolicyURL,
      termsOfServiceUrl:
        manifest.extensions["com.openai"].interface.termsOfServiceURL,
    });
    expect(JSON.parse(readEntry(chatgpt, "mcp.json").toString())).toEqual(
      JSON.parse(
        fs.readFileSync(path.join(root, sourceDir, "mcp.json"), "utf8"),
      ),
    );
    expect(JSON.parse(readEntry(claude, ".mcp.json").toString())).toEqual({
      mcpServers: {
        "lifexam-eu": { type: "http", url: "https://eu.lifexam.com/api/mcp" },
      },
    });
    for (const name of common)
      expect(readEntry(chatgpt, name)).toEqual(readEntry(claude, name));
    for (const name of ["README.md", "LICENSE"])
      expect(readEntry(chatgpt, name)).toEqual(
        fs.readFileSync(path.join(root, sourceDir, name)),
      );
    expect(readEntry(chatgpt, common[0])).toEqual(
      fs.readFileSync(path.join(root, sourceDir, common[0])),
    );
    for (const name of [common[1], common[2]])
      expect(readEntry(chatgpt, name)).toEqual(
        fs.readFileSync(path.join(root, `${sourceDir}/${name}`)),
      );
    expect(runBuild(root, ["--check"])).toContain("up to date");
  });

  it.each([
    ["extra", { type: "streamable-http", url: "https://example.com/mcp" }],
    ["lifexam-us", { type: "streamable-http", url: "https://example.com/mcp" }],
  ])("rejects an additional server %s", (name, server) => {
    const root = createFixture();
    const file = path.join(root, sourceDir, "mcp.json");
    const mcp = JSON.parse(fs.readFileSync(file, "utf8"));
    mcp.mcpServers[name] = server;
    fs.writeFileSync(file, JSON.stringify(mcp));
    expectFailure(root, [], "exactly one server");
    expect(fs.existsSync(path.join(root, "dist"))).toBe(false);
  });

  it.each([
    [
      { type: "http", url: "https://eu.lifexam.com/api/mcp" },
      "streamable-http",
    ],
    [
      {
        type: "streamable-http",
        url: "https://eu.lifexam.com/api/mcp",
        headers: {},
      },
      "only type and url",
    ],
    [null, "must be an object"],
  ])("rejects an invalid lifexam-eu server: %j", (server, message) => {
    const root = createFixture();
    const file = path.join(root, sourceDir, "mcp.json");
    const mcp = JSON.parse(fs.readFileSync(file, "utf8"));
    mcp.mcpServers["lifexam-eu"] = server;
    fs.writeFileSync(file, JSON.stringify(mcp));
    expectFailure(root, [], message);
  });

  it.each(["missing", "changed"])(
    "preserves the required Lifexam endpoint: %s",
    (mode) => {
      const root = createFixture();
      const file = path.join(root, sourceDir, "mcp.json");
      const mcp = JSON.parse(fs.readFileSync(file, "utf8"));
      if (mode === "missing") delete mcp.mcpServers["lifexam-eu"];
      else mcp.mcpServers["lifexam-eu"].url = "https://example.com/mcp";
      fs.writeFileSync(file, JSON.stringify(mcp));
      expectFailure(
        root,
        [],
        mode === "missing" ? "exactly one server" : "url must stay",
      );
    },
  );

  it.each(["claude"])(
    "does not create or overwrite the %s repository package",
    (target) => {
      const root = createFixture();
      const folder = path.join(root, target, "lifexam-eu");
      const before = fs.statSync(path.join(folder, "README.md")).mtimeMs;
      runBuild(root);
      expect(fs.statSync(path.join(folder, "README.md")).mtimeMs).toBe(before);
      fs.rmSync(folder, { recursive: true });
      expectFailure(root, [], "ENOENT");
      expect(fs.existsSync(folder)).toBe(false);
    },
  );

  it("checks tracked platform folders against the shared source", () => {
    const root = createFixture();
    runBuild(root);
    const readme = path.join(root, "claude/lifexam-eu/README.md");
    fs.appendFileSync(readme, "\nUnexpected manual change.\n");
    expectFailure(root, ["--check"], "claude package is stale");
    expectFailure(root, [], "claude package is stale");
    fs.copyFileSync(path.join(root, sourceDir, "README.md"), readme);
    runBuild(root);
    expect(runBuild(root, ["--check"])).toContain("up to date");
    fs.writeFileSync(
      path.join(root, "chatgpt/lifexam-eu/secret.txt"),
      "fixture",
    );
    expectFailure(root, ["--check"], "unexpected file inventory");
  });

  it("rejects symbolic links in maintained repository packages", () => {
    const root = createFixture();
    runBuild(root);
    const outside = path.join(root, "outside.md");
    fs.writeFileSync(outside, "Must stay unchanged");
    const readme = path.join(root, "claude/lifexam-eu/README.md");
    fs.unlinkSync(readme);
    fs.symlinkSync(outside, readme);
    expectFailure(root, [], "regular files");
    expect(fs.readFileSync(outside, "utf8")).toBe("Must stay unchanged");
  });

  it("requires the release tag to match the shared package version", () => {
    const root = createFixture();
    runBuild(root, ["--tag", `v${sourceManifest(root).version}`]);
    expect(
      runBuild(root, ["--check", "--tag", `v${sourceManifest(root).version}`]),
    ).toContain("up to date");
    expectFailure(root, ["--tag", "v9.0.0"], "must match package version");
    expectFailure(
      root,
      ["--tag", "v1.0.4", "--version", "1.0.5"],
      "cannot update",
    );
    expectFailure(root, ["--tag", "bad-tag"], "must be a release tag");
  });

  it("restricts ChatGPT availability to the 30 countries enabled for Lifexam EU", () => {
    const root = createFixture();
    runBuild(root);
    const publication = JSON.parse(
      readEntry(archive(root, "chatgpt"), "plugin.json").toString(),
    ).extensions["com.openai"].publication;
    const expected =
      "AT,BE,BG,HR,CY,CZ,DK,EE,FI,FR,DE,GR,HU,IE,IT,LV,LT,LU,MT,NL,PL,PT,RO,SK,SI,ES,SE,IS,LI,NO".split(
        ",",
      );
    expect(publication.countries).toEqual(expected);
    expect(publication.countries).not.toContain("US");
    expect(publication.countries).not.toContain("GB");
    expect(publication.countries).not.toContain("CH");
  });

  it.each([
    { countries: undefined },
    { countries: [] },
    { countries: ["it"] },
    { countries: ["EUEU"] },
    { countries: ["IT", "IT"] },
    { countries: [null] },
  ])("rejects missing or invalid country restrictions: %j", ({ countries }) => {
    const root = createFixture();
    updateManifest(root, (manifest) => {
      manifest.extensions["com.openai"].publication.countries = countries;
    });
    expectFailure(
      root,
      [],
      "publication.countries must contain a nonempty, unique list",
    );
    expect(fs.existsSync(path.join(root, "dist"))).toBe(false);
  });

  it("exports all six supported listing languages with an English fallback", () => {
    const root = createFixture();
    runBuild(root);
    const openai = JSON.parse(
      readEntry(archive(root, "chatgpt"), "plugin.json").toString(),
    ).extensions["com.openai"];
    const translations = openai.publication.translations;
    expect(Object.keys(translations).sort()).toEqual([
      "de",
      "en",
      "es",
      "fr",
      "it",
      "pt",
    ]);
    for (const locale of Object.keys(translations)) {
      const listings = JSON.parse(
        fs.readFileSync(
          path.join(root, sourceDir, "translations.json"),
          "utf8",
        ),
      );
      expect(translations[locale]).toEqual(listings[locale]);
    }
    expect(openai.interface.shortDescription).toBe(translations.en.subtitle);
    expect(openai.interface.longDescription).toBe(translations.en.description);
  });

  it.each(["en", "it", "fr", "es", "pt", "de"])(
    "rejects missing %s listing copy instead of silently falling back",
    (locale) => {
      const root = createFixture();
      const file = path.join(root, sourceDir, "translations.json");
      const listings = JSON.parse(fs.readFileSync(file, "utf8"));
      delete listings[locale];
      fs.writeFileSync(file, JSON.stringify(listings));
      expectFailure(
        root,
        ["--version", "9.0.0"],
        `translations.json must contain ${locale} listing copy`,
      );
      expect(sourceManifest(root).version).not.toBe("9.0.0");
      expect(fs.existsSync(path.join(root, "dist"))).toBe(false);
    },
  );

  it.each([
    { subtitle: "x".repeat(31), description: "Valid description" },
    { subtitle: "Two\nlines", description: "Valid description" },
    { subtitle: "Valid subtitle", description: "x".repeat(4001) },
    { subtitle: "Valid subtitle", description: "\tUnsupported tab" },
    { subtitle: "Valid subtitle", description: "  " },
  ])("rejects listing text that the platform cannot import: %j", (listing) => {
    const root = createFixture();
    const file = path.join(root, sourceDir, "translations.json");
    const listings = JSON.parse(fs.readFileSync(file, "utf8"));
    listings.fr = listing;
    fs.writeFileSync(file, JSON.stringify(listings));
    expectFailure(root, [], "translations.json fr.");
  });

  it("detects changed translations when checking a previously built archive", () => {
    const root = createFixture();
    runBuild(root);
    const file = path.join(root, sourceDir, "translations.json");
    const listings = JSON.parse(fs.readFileSync(file, "utf8"));
    listings.it.description += " Test.";
    fs.writeFileSync(file, JSON.stringify(listings));
    expectFailure(root, ["--check"], "is stale (plugin.json)");
    runBuild(root);
    expect(runBuild(root, ["--check"])).toContain("up to date");
  });

  it("updates one version and release notes for all outputs, preserving review metadata", () => {
    const root = createFixture();
    updateManifest(root, (manifest) => {
      manifest.extensions["com.openai"].review.demo_recording_url =
        "https://example.com/demo";
    });
    const claudeManifest = path.join(
      root,
      "claude/lifexam-eu/.claude-plugin/plugin.json",
    );
    const manifest = JSON.parse(fs.readFileSync(claudeManifest, "utf8"));
    manifest.version = "1.0.2";
    fs.writeFileSync(claudeManifest, JSON.stringify(manifest, null, 2) + "\n");
    runBuild(root, [
      "--version",
      "1.0.2",
      "--release-notes",
      "Build both platforms",
    ]);
    expect(sourceManifest(root).version).toBe("1.0.2");
    expect(
      sourceManifest(root).extensions["com.openai"].interface.shortDescription,
    ).toBeUndefined();
    expect(
      sourceManifest(root).extensions["com.openai"].publication.translations,
    ).toBeUndefined();
    const openai = JSON.parse(
      readEntry(archive(root, "chatgpt"), "plugin.json").toString(),
    ).extensions["com.openai"];
    expect(openai.publication.release_notes).toBe("Build both platforms");
    expect(openai.publication.countries).toEqual(
      sourceManifest(root).extensions["com.openai"].publication.countries,
    );
    expect(openai.publication.countries).toHaveLength(30);
    expect(openai.review.demo_recording_url).toBe("https://example.com/demo");
    expect(
      JSON.parse(
        readEntry(
          archive(root, "claude"),
          ".claude-plugin/plugin.json",
        ).toString(),
      ).version,
    ).toBe("1.0.2");
    expect(runBuild(root, ["--check"])).toContain("up to date");
  });

  it("creates reproducible archives and supports a custom output directory", () => {
    const root = createFixture();
    const args = ["--out-dir", "dist/custom"];
    runBuild(root, args);
    const outputs = ["chatgpt"].map((target) =>
      path.join(
        root,
        "dist/custom",
        `lifexam-eu-${target}-${sourceManifest(root).version}.zip`,
      ),
    );
    const before = outputs.map((file) => fs.readFileSync(file));
    runBuild(root, args);
    outputs.forEach((file, i) =>
      expect(fs.readFileSync(file)).toEqual(before[i]),
    );
    expect(runBuild(root, [...args, "--check"])).toContain("up to date");
  });

  it.each(["chatgpt"] as const)(
    "rejects extra files in the %s ZIP",
    (target) => {
      const root = createFixture();
      runBuild(root);
      fs.writeFileSync(path.join(root, "unexpected.md"), "old instructions");
      execFileSync("zip", ["-q", archive(root, target), "unexpected.md"], {
        cwd: root,
      });
      expectFailure(root, ["--check"], "unexpected file inventory");
    },
  );

  it("rejects stale shared instructions and missing archives", () => {
    const root = createFixture();
    expectFailure(root, ["--check"], "cannot read");
    runBuild(root);
    fs.appendFileSync(
      path.join(root, sourceDir, "skills/lifexam-health-record/SKILL.md"),
      "\nUpdated instructions.\n",
    );
    expectFailure(root, ["--check"], "is stale");
  });

  it("rejects embedded URL credentials before updating source or outputs", () => {
    const root = createFixture();
    updateManifest(root, (manifest) => {
      manifest.extensions["com.openai"].interface.supportURL =
        "https://user:secret@example.com";
    });
    const before = fs.readFileSync(path.join(root, sourceDir, "plugin.json"));
    expectFailure(root, ["--version", "1.0.2"], "must not embed credentials");
    expect(fs.readFileSync(path.join(root, sourceDir, "plugin.json"))).toEqual(
      before,
    );
    expect(fs.existsSync(path.join(root, "dist"))).toBe(false);
  });

  it("builds and checks valid icons larger than the subprocess default buffer", async () => {
    const root = createFixture();
    const pixels = randomFillSync(Buffer.alloc(512 * 512 * 4));
    const png = await sharp(pixels, {
      raw: { width: 512, height: 512, channels: 4 },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();
    expect(png.length).toBeGreaterThan(1024 * 1024);
    fs.writeFileSync(
      path.join(root, sourceDir, "assets/lifexam-logo.png"),
      png,
    );
    fs.writeFileSync(
      path.join(root, "claude/lifexam-eu/assets/lifexam-logo.png"),
      png,
    );
    runBuild(root);
    expect(runBuild(root, ["--check"])).toContain("up to date");
    expect(
      readEntry(archive(root, "claude"), "assets/lifexam-logo.png").length,
    ).toBe(png.length);
  });

  it("leaves the version unchanged when assets fail validation", () => {
    const root = createFixture();
    fs.writeFileSync(
      path.join(root, sourceDir, "assets/lifexam-icon.png"),
      "not a PNG",
    );
    const before = sourceManifest(root);
    expectFailure(root, ["--version", "1.0.2"], "not a readable PNG");
    expect(sourceManifest(root)).toEqual(before);
  });

  it("rejects descriptions over Claude's upload limit and public app bindings", () => {
    const root = createFixture();
    updateManifest(root, (manifest) => {
      manifest.description = "x".repeat(501);
    });
    expectFailure(root, [], "Claude upload limit");
    updateManifest(root, (manifest) => {
      manifest.description = "Read health records";
      manifest.extensions["com.openai"].apps = "./.app.json";
    });
    expectFailure(root, [], "must not declare apps");
  });

  it.each([
    ["--version="],
    ["--out-dir="],
    ["--version", "1.0.2", "--check"],
    ["--out-dir", sourceDir],
    ["--unknown"],
  ])("rejects invalid options %j", (...args) => {
    const root = createFixture();
    expectFailure(root, args, "plugin build failed");
  });
});
