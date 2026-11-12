// Финальный проход: волновой узор + виньетка + плёночное зерно. Работает уже в sRGB (после OutputPass).
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uGrain;
uniform float uVignette;
uniform vec3 uBg;
uniform vec2 uResolution;
uniform float uWaves;         // сила узора, 0 — выключен
uniform float uWavesDensity;  // сколько линий на высоту экрана
uniform float uScroll;        // прокрутка в экранах — узор медленно плывёт

varying vec2 vUv;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Волновой узор: тонкие волнистые линии во весь экран, как след пульса.
// Высота линии = y + сумма синусов по x; толщина — в пикселях (fwidth), чтобы линии были ровными.
float waves(vec2 uv, float t) {
  vec2 p = vec2(uv.x * uResolution.x / uResolution.y, uv.y);
  float s = uScroll * 0.35;
  float h = p.y * uWavesDensity
    + sin(p.x * 2.1 + t * 0.11 + s) * 0.9
    + sin(p.x * 4.7 - t * 0.07 + p.y * 1.7) * 0.35
    + sin(p.x * 0.8 + p.y * 3.1 + s * 1.3) * 0.6;
  float d = 0.5 - abs(fract(h) - 0.5); // расстояние до ближайшей линии
  float w = fwidth(h);
  float line = 1.0 - smoothstep(0.0, w * 1.1, d);
  // линии мягко проявляются и гаснут пятнами, чтобы узор не был ровной решёткой
  float fade = 0.55 + 0.45 * sin(p.x * 1.3 - p.y * 2.2 + t * 0.05 + s);
  return line * fade;
}

void main() {
  vec3 color = texture2D(tDiffuse, vUv).rgb;

  // узор виден только на тёмном фоне и гаснет под яркими частицами и текстом
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color += vec3(0.957, 0.937, 0.918) * waves(vUv, uTime) * uWaves * (1.0 - smoothstep(0.08, 0.35, lum));

  vec2 q = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
  float v = smoothstep(0.45, 1.25, length(q) * 1.15);
  color = mix(color, uBg * 0.55, v * uVignette);

  float n = hash(gl_FragCoord.xy + fract(uTime * 7.31) * 1024.0) - 0.5;
  color += n * uGrain;

  gl_FragColor = vec4(color, 1.0);
}
