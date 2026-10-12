import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, jsonForScript, safeHref, safeRedirectPath, renderImage } from "../../../src/utils/html.util.js";

describe("escapeHtml", () => {
  it("escapes markup characters and handles null", () => {
    assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    assert.equal(escapeHtml(null), "");
    assert.equal(escapeHtml(undefined), "");
    assert.equal(escapeHtml(5), "5");
  });
});

describe("jsonForScript", () => {
  it("cannot close a script element and round-trips", () => {
    const value = { name: "</script><script>alert(1)</script>", sep: "a b" };
    const out = jsonForScript(value);
    assert.ok(!out.includes("<"));
    assert.ok(!out.includes(">"));
    assert.deepEqual(JSON.parse(out), value);
  });
  it("undefined becomes null", () => assert.equal(jsonForScript(undefined), "null"));
});

describe("safeHref", () => {
  it("allows http(s) and root-relative only", () => {
    assert.equal(safeHref("https://a.rs/x"), "https://a.rs/x");
    assert.equal(safeHref("/blog"), "/blog");
    for (const bad of ["javascript:alert(1)", "//evil.com", "/\\evil.com", "data:text/html,x", "", null, "https://a.rs/ x", " java\nscript:1"]) {
      assert.equal(safeHref(bad), "", String(bad));
    }
  });
});

describe("safeRedirectPath", () => {
  it("accepts same-site paths", () => {
    assert.equal(safeRedirectPath("/nalog/profil?x=1"), "/nalog/profil?x=1");
  });
  it("falls back for anything else", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:1", "", undefined, "/a\nb", "nalog"]) {
      assert.equal(safeRedirectPath(bad, "/home"), "/home", String(bad));
    }
  });
});

describe("renderImage", () => {
  it("escapes url and alt", () => {
    const html = renderImage(`x" onerror="alert(1)`, `<b>`, { width: 100, className: "img-fluid" });
    assert.ok(!html.includes('" onerror="'));
    assert.match(html, /alt="&lt;b&gt;"/);
    assert.match(html, /width="100"/);
  });
});
