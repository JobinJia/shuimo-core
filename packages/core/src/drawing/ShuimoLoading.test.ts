import { describe, expect, it } from "vite-plus/test";
import { generateShuimoLoadingSVG, shuimoLoading } from "./ShuimoLoading";
import { generateShuimoLoadingSVG as exportedGenerateShuimoLoadingSVG } from "./index";

describe("Shuimo loading SVG", () => {
  it("generates a self-contained SVG loading mark", () => {
    const svg = generateShuimoLoadingSVG();

    expect(svg).toMatch(/^<svg\b/);
    expect(svg).toContain('viewBox="0 0 160 160"');
    expect(svg).toContain("<defs>");
    expect(svg).toContain("shuimo-paper");
    expect(svg).toContain("shuimo-ink");
    expect(svg).toContain("<path");
    expect(svg).toContain("<circle");
    expect(svg).not.toContain("#c8102e");
  });

  it("includes SMIL animation by default", () => {
    const svg = generateShuimoLoadingSVG();

    expect(svg).toContain("<animate ");
    expect(svg).toContain("<animateTransform ");
    expect(svg).toContain('repeatCount="indefinite"');
  });

  it("can emit a reduced-motion static SVG", () => {
    const svg = generateShuimoLoadingSVG({ reducedMotion: true });

    expect(svg).not.toContain("<animate ");
    expect(svg).not.toContain("<animateTransform ");
    expect(svg).toContain("<path");
    expect(svg).toContain("<circle");
  });

  it("is deterministic for the same seed", () => {
    const first = generateShuimoLoadingSVG({ seed: 7 });
    const second = generateShuimoLoadingSVG({ seed: 7 });
    const different = generateShuimoLoadingSVG({ seed: 8 });

    expect(first).toBe(second);
    expect(first).not.toBe(different);
  });

  it("applies custom dimensions, colors, duration, and title", () => {
    const svg = generateShuimoLoadingSVG({
      width: 96,
      height: 128,
      inkColor: "#222831",
      paperColor: "#fffaf0",
      duration: 3.5,
      title: "Generating ink",
    });

    expect(svg).toContain('width="96"');
    expect(svg).toContain('height="128"');
    expect(svg).toContain('viewBox="0 0 96 128"');
    expect(svg).toContain("#222831");
    expect(svg).toContain("#fffaf0");
    expect(svg).toContain('dur="3.5s"');
    expect(svg).toContain(">Generating ink</title>");
  });

  it("escapes string values used in XML", () => {
    const svg = generateShuimoLoadingSVG({
      inkColor: `" onload="alert(1)`,
      title: `Loading <ink> & "paper"`,
    });

    expect(svg).toContain("&quot; onload=&quot;alert(1)");
    expect(svg).toContain("Loading &lt;ink&gt; &amp; &quot;paper&quot;");
    expect(svg).not.toContain(`" onload="alert(1)`);
  });

  it("exports the generator from drawing entry points", () => {
    expect(shuimoLoading({ reducedMotion: true })).toBe(
      generateShuimoLoadingSVG({ reducedMotion: true }),
    );
    expect(exportedGenerateShuimoLoadingSVG({ reducedMotion: true })).toBe(
      generateShuimoLoadingSVG({ reducedMotion: true }),
    );
  });
});
