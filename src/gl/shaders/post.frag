// Финальный проход: виньетка + плёночное зерно. Работает уже в sRGB (после OutputPass).
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uGrain;
uniform float uVignette;
uniform vec3 uBg;
uniform vec2 uResolution;

varying vec2 vUv;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 color = texture2D(tDiffuse, vUv).rgb;

  vec2 q = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
  float v = smoothstep(0.45, 1.25, length(q) * 1.15);
  color = mix(color, uBg * 0.55, v * uVignette);

  float n = hash(gl_FragCoord.xy + fract(uTime * 7.31) * 1024.0) - 0.5;
  color += n * uGrain;

  gl_FragColor = vec4(color, 1.0);
}
