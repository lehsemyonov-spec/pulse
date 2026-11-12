uniform vec3 uColorCream;
uniform vec3 uColorAccent;
uniform float uBrightness;

varying float vAlpha;
varying float vAccent;
varying float vBeat;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  // мягкая круглая точка: плотное ядро + ореол (остальное свечение даёт bloom)
  float core = smoothstep(0.5, 0.0, d);
  core *= core;

  vec3 color = mix(uColorCream, uColorAccent, vAccent);
  float glow = 1.0 + vBeat * (0.3 + vAccent * 1.0);

  gl_FragColor = vec4(color * core * vAlpha * uBrightness * glow, 1.0);
}
