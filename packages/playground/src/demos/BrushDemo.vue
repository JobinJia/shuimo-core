<template>
  <div class="brush-demo">
    <div class="demo-header">
      <h2>🖌️ Brush Stroke (毛笔笔触)</h2>
      <p class="description">
        Traditional Chinese calligraphy brush strokes with realistic ink effects
      </p>
    </div>

    <div class="controls">
      <div class="control-group">
        <label>Random Seed:</label>
        <input
          v-model.number="seed"
          type="number"
          @input="regenerate"
        />
        <button @click="randomizeSeed">Randomize</button>
      </div>
    </div>

    <div class="canvas-container">
      <div class="canvas-wrapper" v-html="svgContent"></div>
    </div>

    <div class="info-section">
      <h3>Brush Stroke Features (笔触特点)</h3>
      <div class="feature-grid">
        <div class="feature-card">
          <h4>起笔 (Qǐbǐ - Starting Stroke)</h4>
          <p>The brush enters the paper with concentrated ink and gradually builds pressure.</p>
          <ul>
            <li>Higher ink concentration at start</li>
            <li>Soft pressure build-up</li>
            <li>Organic edge variation</li>
          </ul>
        </div>

        <div class="feature-card">
          <h4>行笔 (Xíngbǐ - Moving Stroke)</h4>
          <p>Continuous movement with stable pressure and gradual ink depletion.</p>
          <ul>
            <li>Consistent width variation</li>
            <li>Ink fading along the path</li>
            <li>Natural texture marks</li>
          </ul>
        </div>

        <div class="feature-card">
          <h4>收笔 (Shōubǐ - Ending Stroke)</h4>
          <p>The brush lifts from paper, creating flying white effect (飞白).</p>
          <ul>
            <li>Pressure release</li>
            <li>Flying white gaps</li>
            <li>Faded ink at the end</li>
          </ul>
        </div>

        <div class="feature-card">
          <h4>笔锋 (Bǐfēng - Brush Tip)</h4>
          <p>Variable brush tip creates natural width and texture changes.</p>
          <ul>
            <li>Perlin noise edge variation</li>
            <li>Pressure-sensitive width</li>
            <li>Ink absorption texture</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="info-section">
      <h3>Example Strokes</h3>
      <div class="examples-info">
        <div class="example-item">
          <strong>1. Natural Strokes:</strong> Curved paths with varying pressure
        </div>
        <div class="example-item">
          <strong>2. Straight Strokes:</strong> Direct lines with ink depletion
        </div>
        <div class="example-item">
          <strong>3. Calligraphy Sample:</strong> Character-like strokes
        </div>
        <div class="example-item">
          <strong>4. Brush Dots:</strong> Single stamp-like marks
        </div>
        <div class="example-item">
          <strong>5. Thick Strokes:</strong> Wide brush with strong texture
        </div>
      </div>
    </div>

    <div class="info-section">
      <h3>Technical Implementation</h3>
      <div class="tech-details">
        <div class="tech-item">
          <h4>Ink Gradient (墨色渐变)</h4>
          <p>
            Ink concentration decreases from start (90%) to end (30-40%),
            simulating natural ink depletion on the brush.
          </p>
        </div>
        <div class="tech-item">
          <h4>Pressure Curve (压力曲线)</h4>
          <p>
            Dynamic pressure function controls stroke width: soft entry,
            firm middle, soft exit for natural calligraphy feel.
          </p>
        </div>
        <div class="tech-item">
          <h4>Flying White Effect (飞白效果)</h4>
          <p>
            Random gaps appear in the last 30% of stroke using Perlin noise,
            creating the characteristic dry brush effect.
          </p>
        </div>
        <div class="tech-item">
          <h4>Texture Marks (纹理效果)</h4>
          <p>
            Small organic blobs simulate ink absorption into paper fibers,
            creating depth and traditional ink wash appearance.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Brush } from '@shuimo/core';
import type { Polygon } from '@shuimo/core';

const seed = ref(12345);

function randomizeSeed() {
  seed.value = Math.floor(Math.random() * 100000);
  regenerate();
}

function regenerate() {
  Math.random = seededRandom(seed.value);
}

function seededRandom(seed: number) {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

const svgContent = computed(() => {
  // Reset random with seed
  Math.random = seededRandom(seed.value);

  const width = 1000;
  const height = 800;
  let content = '';

  // Section 1: Natural curved strokes
  content += `<text x="50" y="40" font-size="18" font-weight="bold" fill="#333">1. Natural Brush Strokes (自然笔触)</text>`;

  // Curved stroke 1
  const curve1: Polygon = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const x = 100 + t * 250;
    const y = 80 + Math.sin(t * Math.PI * 2) * 30;
    curve1.push([x, y]);
  }
  content += Brush.naturalStroke(curve1, {
    width: 10,
    color: 'rgba(40,40,40,0.9)',
    flyingWhite: 0.4
  });

  // Curved stroke 2 - S curve
  const curve2: Polygon = [];
  for (let i = 0; i <= 35; i++) {
    const t = i / 35;
    const x = 100 + t * 250;
    const y = 150 + Math.sin(t * Math.PI) * 40;
    curve2.push([x, y]);
  }
  content += Brush.naturalStroke(curve2, {
    width: 12,
    color: 'rgba(50,60,50,0.85)',
    flyingWhite: 0.3
  });

  // Section 2: Straight strokes with varying width
  content += `<text x="450" y="40" font-size="18" font-weight="bold" fill="#333">2. Direct Strokes (直笔)</text>`;

  const straight1: Polygon = [[500, 70], [500, 180]];
  content += Brush.stroke(straight1, {
    width: 8,
    color: 'rgba(30,30,30,0.9)',
    pressure: (t) => 0.5 + Math.sin(t * Math.PI) * 0.5,
    flyingWhite: 0.5
  });

  const straight2: Polygon = [[550, 70], [550, 180]];
  content += Brush.stroke(straight2, {
    width: 15,
    color: 'rgba(40,50,40,0.85)',
    pressure: (t) => 1.0 - t * 0.5,
    flyingWhite: 0.4
  });

  const straight3: Polygon = [[600, 70], [700, 150]];
  content += Brush.stroke(straight3, {
    width: 10,
    color: 'rgba(35,35,35,0.9)',
    inkStart: 0.95,
    inkEnd: 0.25,
    flyingWhite: 0.6
  });

  // Section 3: Calligraphy-like strokes (resembling "永" character)
  content += `<text x="50" y="250" font-size="18" font-weight="bold" fill="#333">3. Calligraphy Sample (书法示例)</text>`;

  // Horizontal stroke (横)
  const heng: Polygon = [[100, 290], [150, 285], [200, 288], [250, 290]];
  content += Brush.stroke(heng, {
    width: 8,
    color: 'rgba(20,20,20,0.95)',
    pressure: (t) => {
      if (t < 0.2) return 0.6 + t * 2;
      if (t > 0.8) return 1.2 - (t - 0.8) * 2;
      return 1.0;
    },
    flyingWhite: 0.3
  });

  // Vertical stroke (竖)
  const shu: Polygon = [[180, 310], [182, 360], [180, 410], [178, 450]];
  content += Brush.stroke(shu, {
    width: 9,
    color: 'rgba(25,25,25,0.92)',
    pressure: (t) => 0.8 + Math.sin(t * Math.PI) * 0.3,
    flyingWhite: 0.4
  });

  // Left falling stroke (撇)
  const pie: Polygon = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const x = 180 - t * 80;
    const y = 320 + t * 100;
    pie.push([x, y]);
  }
  content += Brush.stroke(pie, {
    width: 10,
    color: 'rgba(30,30,30,0.9)',
    pressure: (t) => 1.2 - t * 0.9,
    flyingWhite: 0.7
  });

  // Right falling stroke (捺)
  const na: Polygon = [];
  for (let i = 0; i <= 25; i++) {
    const t = i / 25;
    const x = 180 + t * 90;
    const y = 320 + t * 90;
    na.push([x, y]);
  }
  content += Brush.stroke(na, {
    width: 7,
    color: 'rgba(28,28,28,0.92)',
    pressure: (t) => {
      if (t < 0.3) return 0.5 + t * 1.5;
      if (t > 0.7) return 1.0 + (t - 0.7) * 0.3;
      return 0.95;
    },
    flyingWhite: 0.5
  });

  // Section 4: Brush dots
  content += `<text x="450" y="250" font-size="18" font-weight="bold" fill="#333">4. Brush Dots (点)</text>`;

  const dotPositions = [
    [500, 290], [550, 300], [600, 295],
    [520, 340], [580, 345], [640, 338],
    [500, 385], [560, 390], [620, 382]
  ];

  dotPositions.forEach(([x, y]) => {
    content += Brush.dot(x, y, {
      width: 10 + Math.random() * 8,
      color: `rgba(${30 + Math.random() * 20},${30 + Math.random() * 20},${30 + Math.random() * 20},${0.85 + Math.random() * 0.1})`,
      noise: 0.6 + Math.random() * 0.3,
      texture: 3 + Math.floor(Math.random() * 4)
    });
  });

  // Section 5: Thick strokes with strong texture
  content += `<text x="50" y="500" font-size="18" font-weight="bold" fill="#333">5. Thick Brush Strokes (粗笔)</text>`;

  const thick1: Polygon = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const x = 100 + t * 300;
    const y = 550 + Math.sin(t * Math.PI * 3) * 25;
    thick1.push([x, y]);
  }
  content += Brush.stroke(thick1, {
    width: 25,
    color: 'rgba(35,40,35,0.88)',
    pressure: (t) => 0.9 + Math.sin(t * Math.PI * 5) * 0.15,
    inkStart: 0.95,
    inkEnd: 0.35,
    noise: 0.7,
    flyingWhite: 0.4,
    texture: 12
  });

  const thick2: Polygon = [];
  for (let i = 0; i <= 35; i++) {
    const t = i / 35;
    const x = 150 + t * 200;
    const y = 650 + Math.cos(t * Math.PI * 2) * 30;
    thick2.push([x, y]);
  }
  content += Brush.stroke(thick2, {
    width: 30,
    color: 'rgba(30,35,30,0.9)',
    pressure: (t) => {
      const base = 1.0;
      const variation = Math.sin(t * Math.PI * 4) * 0.2;
      return base + variation;
    },
    inkStart: 0.92,
    inkEnd: 0.3,
    noise: 0.75,
    flyingWhite: 0.45,
    texture: 15
  });

  // More artistic strokes
  content += `<text x="450" y="500" font-size="18" font-weight="bold" fill="#333">6. Artistic Variations (艺术变化)</text>`;

  // Spiral-like stroke
  const spiral: Polygon = [];
  for (let i = 0; i <= 50; i++) {
    const t = i / 50;
    const angle = t * Math.PI * 4;
    const radius = 30 + t * 40;
    const x = 600 + Math.cos(angle) * radius;
    const y = 600 + Math.sin(angle) * radius;
    spiral.push([x, y]);
  }
  content += Brush.naturalStroke(spiral, {
    width: 6,
    color: 'rgba(40,40,40,0.85)',
    flyingWhite: 0.5
  });

  // Wave pattern
  const wave: Polygon = [];
  for (let i = 0; i <= 45; i++) {
    const t = i / 45;
    const x = 750 + t * 200;
    const y = 550 + Math.sin(t * Math.PI * 6) * 20 + Math.cos(t * Math.PI * 3) * 15;
    wave.push([x, y]);
  }
  content += Brush.stroke(wave, {
    width: 8,
    color: 'rgba(45,50,45,0.87)',
    pressure: (t) => 0.7 + Math.sin(t * Math.PI * 8) * 0.3,
    flyingWhite: 0.4,
    texture: 8
  });

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <!-- Paper texture filter -->
        <filter id="paper-texture">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" result="noise"/>
          <feColorMatrix in="noise" type="saturate" values="0" result="desaturated"/>
          <feComponentTransfer in="desaturated" result="contrast">
            <feFuncA type="linear" slope="0.15" intercept="0"/>
          </feComponentTransfer>
          <feBlend in="SourceGraphic" in2="contrast" mode="multiply"/>
        </filter>
      </defs>

      <!-- Background -->
      <rect width="${width}" height="${height}" fill="#f8f5f0"/>

      <!-- Content with paper texture -->
      <g filter="url(#paper-texture)">
        ${content}
      </g>
    </svg>
  `;
});

onMounted(() => {
  regenerate();
});
</script>

<style scoped>
.brush-demo {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.demo-header {
  text-align: center;
  margin-bottom: 2rem;
}

.demo-header h2 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: #333;
}

.description {
  font-size: 1.1rem;
  color: #666;
}

.controls {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.control-group label {
  font-weight: 500;
}

.control-group input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 100px;
}

.control-group button {
  padding: 0.5rem 1rem;
  background: #4a5568;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.control-group button:hover {
  background: #2d3748;
}

.canvas-container {
  margin-bottom: 3rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  padding: 1rem;
}

.canvas-wrapper {
  width: 100%;
  overflow: auto;
}

.info-section {
  margin-bottom: 2rem;
}

.info-section h3 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: #333;
  border-bottom: 2px solid #4a5568;
  padding-bottom: 0.5rem;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.feature-card {
  background: #f9f9f9;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid #4a5568;
}

.feature-card h4 {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
  color: #2d3748;
}

.feature-card p {
  color: #666;
  margin-bottom: 0.75rem;
  line-height: 1.5;
}

.feature-card ul {
  list-style: none;
  padding-left: 0;
}

.feature-card li {
  padding: 0.25rem 0;
  color: #555;
  position: relative;
  padding-left: 1.2rem;
}

.feature-card li:before {
  content: "▸";
  position: absolute;
  left: 0;
  color: #4a5568;
}

.examples-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.example-item {
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 4px;
  border-left: 3px solid #4a5568;
}

.example-item strong {
  color: #2d3748;
}

.tech-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.tech-item {
  background: #fff;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.tech-item h4 {
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
  color: #2d3748;
}

.tech-item p {
  color: #555;
  line-height: 1.6;
}
</style>
