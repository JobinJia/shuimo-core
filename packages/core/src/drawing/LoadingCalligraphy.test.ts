import { describe, expect, it } from "vite-plus/test";
import { generateCalligraphyLoadingSVG, calligraphyLoading } from "./LoadingCalligraphy";
import { generateCalligraphyLoadingSVG as exportedGenerateCalligraphyLoadingSVG } from "./index";

describe("Calligraphy loading SVG", () => {
  it("generates a self-contained SVG loading mark", () => {
    const svg = generateCalligraphyLoadingSVG();

    expect(svg).toMatch(/^<svg\b/);
    expect(svg).toContain('viewBox="0 0 160 160"');
    expect(svg).toContain("<defs>");
    expect(svg).toContain("calligraphy-paper");
    expect(svg).toContain("calligraphy-ink");
    expect(svg).toContain("<path");
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain("<circle");
  });

  it("includes SMIL animation by default", () => {
    const svg = generateCalligraphyLoadingSVG();

    expect(svg).toContain("<animate ");
    expect(svg).toContain('repeatCount="indefinite"');
  });

  it("can emit a reduced-motion static SVG", () => {
    const svg = generateCalligraphyLoadingSVG({ reducedMotion: true });

    expect(svg).not.toContain("<animate ");
    expect(svg).toContain("<path");
    expect(svg).toContain("<circle");
  });

  it("is deterministic for the same seed", () => {
    const first = generateCalligraphyLoadingSVG({ seed: 7 });
    const second = generateCalligraphyLoadingSVG({ seed: 7 });
    const different = generateCalligraphyLoadingSVG({ seed: 8 });

    expect(first).toBe(second);
    expect(first).not.toBe(different);
  });

  it("applies custom dimensions, colors, duration, and title", () => {
    const svg = generateCalligraphyLoadingSVG({
      width: 96,
      height: 128,
      inkColor: "#222831",
      paperColor: "#fffaf0",
      duration: 3.5,
      title: "Writing brush",
    });

    expect(svg).toContain('width="96"');
    expect(svg).toContain('height="128"');
    expect(svg).toContain('viewBox="0 0 96 128"');
    expect(svg).toContain("#222831");
    expect(svg).toContain("#fffaf0");
    expect(svg).toContain('dur="3.5s"');
    expect(svg).toContain(">Writing brush</title>");
  });

  it("escapes string values used in XML", () => {
    const svg = generateCalligraphyLoadingSVG({
      inkColor: `" onload="alert(1)`,
      title: `Loading <ink> & "paper"`,
    });

    expect(svg).toContain("&quot; onload=&quot;alert(1)");
    expect(svg).toContain("Loading &lt;ink&gt; &amp; &quot;paper&quot;");
    expect(svg).not.toContain(`" onload="alert(1)`);
  });

  it("exports the generator from drawing entry points", () => {
    expect(calligraphyLoading({ reducedMotion: true })).toBe(
      generateCalligraphyLoadingSVG({ reducedMotion: true }),
    );
    expect(exportedGenerateCalligraphyLoadingSVG({ reducedMotion: true })).toBe(
      generateCalligraphyLoadingSVG({ reducedMotion: true }),
    );
  });
});
