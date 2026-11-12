uniform float uTime;
uniform float uPixelRatio;
uniform float uSize;

uniform float uNoiseStrength;
uniform float uNoiseSpeed;
uniform float uNoiseScale;

// Двойной удар «ту-дум» — та же формула, что в src/core/beat.ts
uniform float uBeatPeriod;
uniform float uBeatScale;
uniform float uBeatSecond;
uniform float uBeatGap;
uniform float uBeatWave;

uniform vec2 uMouse;        // NDC, сглаженный
uniform float uMouseActive; // 0–1
uniform float uMouseRadius;
uniform float uMouseStrength;
uniform float uAspect;

uniform float uDepthFade;
uniform float uCoralRatio;

attribute vec4 aRandom; // x — фаза, y — размер, z — выбор коралла, w — яркость/сила

varying float vAlpha;
varying float vCoral;
varying float vBeat;

#include <noise>

float hit(float x) {
  if (x < 0.0) return 0.0;
  float k = x / 0.07;
  return k * exp(1.0 - k);
}

float beat(float t) {
  float p = mod(t, uBeatPeriod);
  return max(hit(p), uBeatSecond * hit(p - uBeatGap));
}

void main() {
  vec3 pos = position;

  // Удар расходится от центра волной
  float b = beat(uTime - length(pos) * uBeatWave);
  pos *= 1.0 + uBeatScale * b;

  // Дыхание: curl-noise, у каждой точки своя фаза
  vec3 flow = curlNoise(pos * uNoiseScale + vec3(0.0, 0.0, uTime * uNoiseSpeed) + aRandom.x * 0.35);
  pos += flow * uNoiseStrength;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);

  // Отталкивание курсором — в экранных координатах, чтобы радиус был одинаковым на любой глубине
  vec4 clip = projectionMatrix * mv;
  vec2 d = clip.xy / clip.w - uMouse;
  d.x *= uAspect;
  float dist = length(d);
  // у каждой точки свой радиус и сила — край «раздвинутой» зоны рваный, а не циркульный
  float r = uMouseRadius * (0.7 + 0.6 * aRandom.x);
  float f = smoothstep(r, 0.0, dist);
  f = f * uMouseActive * (0.35 + 1.1 * aRandom.w);
  vec2 dir = dist > 1e-5 ? d / dist : vec2(0.0);
  mv.xy += dir * f * uMouseStrength * (-mv.z) * 0.12;
  mv.z += f * uMouseStrength * 0.6;

  gl_Position = projectionMatrix * mv;

  // Глубина относительно центра формы: задняя сторона тусклее
  float scale = length(modelMatrix[0].xyz);
  float centerZ = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).z;
  float back = clamp((centerZ - mv.z) / (2.0 * scale) + 0.5, 0.0, 1.0);

  vCoral = step(1.0 - uCoralRatio, aRandom.z);
  vBeat = b;
  vAlpha = (1.0 - uDepthFade * back) * (0.45 + 0.55 * aRandom.w) * (1.0 + f * 0.8);

  float size = uSize * (0.45 + 1.1 * aRandom.y * aRandom.y);
  size *= 1.0 + vCoral * (0.45 + 0.35 * b);
  gl_PointSize = size * uPixelRatio * (6.0 / -mv.z);
}
