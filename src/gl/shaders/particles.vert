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

// Морфинг: position — форма «из», aTo — форма «в»
uniform float uProgress;    // 0–1 общий прогресс перехода
uniform float uSpread;      // насколько растянута волна (0 — все разом)
uniform float uSwirl;       // сила завихрения в полёте
uniform float uSwirlScale;
uniform float uBeatAmount;  // насколько форма бьётся (у хаоса 0 — общего ритма нет)
uniform float uDrift;       // одиночный дрейф точек (хаос)
uniform float uNoiseAmount;
uniform float uShapeBrightness;
uniform float uGapFrom;     // разведение рук по X, если форма — руки
uniform float uGapTo;

uniform float uFlashTime;   // момент касания рук
uniform vec3 uFlashOrigin;  // точка касания
uniform float uFlashSpeed;
uniform float uFlashPush;
uniform float uFlashIntensity;

attribute vec3 aTo;
attribute float aDelay;
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

float easeInOutCubic(float x) {
  return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0;
}

void main() {
  vec3 from = position;
  vec3 to = aTo;
  from.x += sign(from.x) * uGapFrom;
  to.x += sign(to.x) * uGapTo;

  // Волна: задержка точки = её случайность + пятно шума по месту старта
  float spatial = snoise(from * 0.45) * 0.5 + 0.5;
  float delay = mix(aDelay, spatial, 0.65);
  float lp = clamp(uProgress * (1.0 + uSpread) - delay * uSpread, 0.0, 1.0);
  lp = easeInOutCubic(lp);
  vec3 pos = mix(from, to, lp);

  // В полёте точки закручивает curl-noise; на старте и финише — ноль
  float flight = sin(lp * 3.14159265);
  pos += curlNoise(pos * uSwirlScale + vec3(uTime * 0.12, 0.0, aDelay * 2.0)) * uSwirl * flight;

  // Удар расходится от центра волной
  float b = beat(uTime - length(pos) * uBeatWave) * uBeatAmount;
  pos *= 1.0 + uBeatScale * b;

  // Дыхание: curl-noise, у каждой точки своя фаза
  vec3 flow = curlNoise(pos * uNoiseScale + vec3(0.0, 0.0, uTime * uNoiseSpeed) + aRandom.x * 0.35);
  pos += flow * uNoiseStrength * uNoiseAmount;

  // Одиночный дрейф: каждая точка сама по себе
  vec3 ph = aRandom.xyw * 6.2831853;
  pos += vec3(sin(uTime * 0.31 + ph.x), cos(uTime * 0.27 + ph.y), sin(uTime * 0.23 + ph.z)) * 0.16 * uDrift;

  // Касание: вспышка в точке встречи и волна по всему облаку
  float flashWave = 0.0;
  float flashCore = 0.0;
  float age = uTime - uFlashTime;
  if (age > 0.0 && age < 3.5) {
    vec3 dv = pos - uFlashOrigin;
    float d = length(dv);
    float r = age * uFlashSpeed;
    flashWave = exp(-pow((d - r) * 3.0, 2.0)) * exp(-age * 1.1) * uFlashIntensity;
    flashCore = exp(-d * 2.2) * exp(-age * 2.6) * uFlashIntensity;
    pos += (d > 1e-4 ? dv / d : vec3(0.0)) * flashWave * uFlashPush;
  }

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

  vCoral = max(step(1.0 - uCoralRatio, aRandom.z), clamp(flashCore * 1.5, 0.0, 1.0));
  vBeat = b;
  vAlpha = uShapeBrightness * (1.0 - uDepthFade * back) * (0.45 + 0.55 * aRandom.w) * (1.0 + f * 0.8) * (1.0 + flashWave * 2.5 + flashCore * 4.0);

  float size = uSize * (0.45 + 1.1 * aRandom.y * aRandom.y);
  size *= 1.0 + vCoral * (0.45 + 0.35 * b);
  gl_PointSize = size * uPixelRatio * (6.0 / -mv.z);
}
