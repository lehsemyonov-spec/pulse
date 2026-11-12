uniform vec3 uColorCream;
uniform vec3 uColorCoral;
uniform float uBrightness;

varying float vAlpha;
varying float vCoral;
varying float vBeat;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  // мягкая круглая точка: плотное ядро + ореол (остальное свечение даёт bloom)
  float core = smoothstep(0.5, 0.0, d);
  core *= core;

  vec3 color = mix(uColorCream, uColorCoral, vCoral);
  float glow = 1.0 + vBeat * (0.3 + vCoral * 1.0);

  gl_FragColor = vec4(color * core * vAlpha * uBrightness * glow, 1.0);
}
