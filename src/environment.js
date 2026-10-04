import * as THREE from 'three';

/** An HDR studio made of softboxes and narrow spectral reflections.
 * It supplies real view-dependent reflections, not a photograph on the coin. */
export function createStudioEnvironment(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#03040a');
  const addPanel = (position, width, height, color, intensity) => {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    panel.position.set(...position);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  };
  addPanel([-5, 4, 6], 4.5, 8, '#f4f6ff', 3.5);
  addPanel([5, -2, 3], 3, 7, '#ffffff', 2.8);
  addPanel([1, 7, -3], 8, 2, '#e7edff', 3);
  addPanel([-3, -5, -4], 5, 3, '#788dff', 1.8);
  addPanel([1, 1, -7], 2.2, 5, '#ffffff', 2.2);
  const reflectionCanvas = document.createElement('canvas');
  reflectionCanvas.width = 1024;
  reflectionCanvas.height = 1024;
  const ctx = reflectionCanvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.translate(512, 512);
  ctx.rotate(-0.55);
  const gradient = ctx.createLinearGradient(-420, 0, 420, 0);
  const stops = [[0, '#04010c'], [0.1, '#08021f'], [0.18, '#2510ff'], [0.21, '#008cff'], [0.24, '#16ffff'], [0.28, '#fffbd9'], [0.34, '#ffffff'], [0.68, '#ffffff'], [0.73, '#fffbce'], [0.77, '#ff5433'], [0.8, '#bb08ff'], [0.84, '#091cff'], [0.89, '#020c16'], [1, '#000000']];
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(-500, -490, 1000, 980);
  const reflectionTexture = new THREE.CanvasTexture(reflectionCanvas);
  reflectionTexture.colorSpace = THREE.SRGBColorSpace;
  const spectralIntensity = 2.8;
  const spectralSoftbox = new THREE.Mesh(new THREE.PlaneGeometry(15, 14), new THREE.MeshBasicMaterial({ map: reflectionTexture, color: new THREE.Color(spectralIntensity, spectralIntensity, spectralIntensity), side: THREE.DoubleSide }));
  spectralSoftbox.position.set(0, 0, 7);
  spectralSoftbox.lookAt(0, 0, 0);
  studio.add(spectralSoftbox);
  // Adjacent narrow bands produce the oil-slick edge spectrum.
  const spectrum = ['#3a1cff', '#1764ff', '#00e3ff', '#19f1ba', '#e9ff4d', '#ff6526', '#e71cba'];
  spectrum.forEach((color, index) => {
    addPanel([-5.8 + index * 0.24, 0.3, 3], 0.24, 5.8, color, 2.2);
    addPanel([4.8, -2.3 + index * 0.21, -3.5], 5.5, 0.21, spectrum[(index + 2) % spectrum.length], 2.4);
  });
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(studio, 0.002, 0.1, 100);
  pmrem.dispose();
  studio.traverse(object => {
    if (object.isMesh) { object.geometry.dispose(); object.material.dispose(); }
  });
  reflectionTexture.dispose();
  return target;
}

/** Every coin uses the hero's studio. Viewing angle supplies the variation. */
export function setupCoinStudio(scene, renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  const environment = createStudioEnvironment(renderer);
  scene.environment = environment.texture;
  scene.environmentRotation.set(0, 0, 0);
  const key = new THREE.DirectionalLight('#ecf2ff', 1.5);
  key.position.set(-3, 5, 8);
  const fill = new THREE.DirectionalLight('#9fb6ff', 0.7);
  fill.position.set(5, -2, -5);
  scene.add(key, fill);
  return environment;
}

export function createGlassMaterial(index) {
  const material = new THREE.MeshPhysicalMaterial({
    color: '#edf3ff',
    metalness: 0.94,
    roughness: 0.035,
    transmission: 0.2,
    thickness: 0.38,
    ior: 1.75,
    clearcoat: 1,
    clearcoatRoughness: 0.025,
    iridescence: 1,
    iridescenceIOR: 1.8,
    iridescenceThicknessRange: [120 + index * 12, 430 + index * 18],
    dispersion: 0.85,
    envMapIntensity: 1.7,
    attenuationColor: new THREE.Color('#b1b9ed'),
    attenuationDistance: 2.5,
  });
  // A continuous optical crown bends reflections smoothly across the planar
  // faces, without the triangular facets of a deformed, sparse face mesh.
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCrownShift;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvCrownShift = normalMatrix * vec3(position.xy * 0.38 * sign(normal.z), 0.0) * smoothstep(0.7, 0.98, abs(normal.z));');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCrownShift;')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(normal + vCrownShift);');
  };
  material.customProgramCacheKey = () => 'optical-crown-v1';
  return material;
}
