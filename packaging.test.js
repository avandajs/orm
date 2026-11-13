const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const pkg = require("./package.json");

// 0.4.0 shipped exports["."].bun = "./index.ts", which made Bun load the
// TypeScript source instead of the build. Requiring @avanda/orm by package
// name under Bun 1.2.13 then failed with:
//   SyntaxError: export default cannot be used with export *
// Node was unaffected because it takes the "default" condition, so this only
// broke Bun dev servers and `bun test`. Keep runtime conditions pointing at
// the build; "types" may keep pointing at the sources.
test("no runtime export condition points at TypeScript source", () => {
  const entry = pkg.exports?.["."] ?? {};
  for (const [condition, target] of Object.entries(entry)) {
    if (condition === "types") continue;
    assert.ok(
      !String(target).endsWith(".ts"),
      `exports["."].${condition} is ${target}; a runtime condition must point at the build, not a .ts file`
    );
  }
  assert.strictEqual(entry.bun, undefined, "the bun condition must stay off");
});

test("the entry points the package advertises exist", () => {
  for (const p of [pkg.main, pkg.exports?.["."]?.default].filter(Boolean)) {
    assert.ok(fs.existsSync(path.join(__dirname, p)), `${p} is missing`);
  }
});

test("the published entry point actually loads", () => {
  const entry = path.join(__dirname, pkg.exports?.["."]?.default ?? pkg.main);
  const out = execFileSync(
    process.execPath,
    ["-e", `const m=require(${JSON.stringify(entry)});process.stdout.write(Object.keys(m).join(","))`],
    { encoding: "utf8" }
  );
  for (const name of ["Model", "Column", "Fnc", "Transaction"]) {
    assert.ok(out.split(",").includes(name), `${name} is not exported`);
  }
});
