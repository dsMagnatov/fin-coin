import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;

function roundedPolygon(points, rounding = 0.1) {
  const path = new THREE.Path();
  const corners = points.map((point, i) => {
    const prev = points[(i + points.length - 1) % points.length];
    const next = points[(i + 1) % points.length];
    return {
      point,
      before: [point[0] + (prev[0] - point[0]) * rounding, point[1] + (prev[1] - point[1]) * rounding],
      after: [point[0] + (next[0] - point[0]) * rounding, point[1] + (next[1] - point[1]) * rounding],
    };
  });
  path.moveTo(...corners[0].before);
  for (const corner of corners) {
    path.lineTo(...corner.before);
    path.quadraticCurveTo(...corner.point, ...corner.after);
  }
  path.closePath();
  return path;
}

function polarPolygon(sides, radius, angle = 0) {
  return Array.from({ length: sides }, (_, i) => [Math.cos(angle + i / sides * TAU) * radius, Math.sin(angle + i / sides * TAU) * radius]);
}

function clover(radius, indentation, phase = 0) {
  const path = new THREE.Path();
  for (let i = 0; i <= 160; i++) {
    const angle = i / 160 * TAU;
    const r = radius + indentation * Math.cos(angle * 4 + phase);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
  }
  path.closePath();
  return path;
}

export const coinNames = ['Petals', 'Diamond', 'Hexagon', 'North star', 'Four diamonds', 'Clover'];

export function createCoinGeometry(index) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 1, 0, TAU, false);

  switch (index) {
    case 0:
      for (let i = 0; i < 4; i++) {
        const hole = new THREE.Path();
        hole.moveTo(0.12, 0.14);
        hole.bezierCurveTo(0.12, 0.35, 0.28, 0.66, 0.58, 0.65);
        hole.bezierCurveTo(0.71, 0.59, 0.69, 0.38, 0.46, 0.24);
        hole.bezierCurveTo(0.32, 0.15, 0.23, 0.13, 0.12, 0.14);
        const points = hole.getPoints(36).map(p => p.rotateAround(new THREE.Vector2(), i * Math.PI / 2));
        shape.holes.push(new THREE.Path(points));
      }
      break;
    case 1:
      shape.holes.push(roundedPolygon(polarPolygon(4, 0.72, 0), 0.13));
      break;
    case 2:
      shape.holes.push(roundedPolygon(polarPolygon(6, 0.72, 0), 0.07));
      break;
    case 3: {
      const hole = new THREE.Path();
      hole.moveTo(0, 0.73);
      hole.bezierCurveTo(0.12, 0.73, 0.11, 0.27, 0.29, 0.18);
      hole.bezierCurveTo(0.41, 0.1, 0.73, 0.12, 0.73, 0);
      hole.bezierCurveTo(0.73, -0.12, 0.27, -0.11, 0.18, -0.29);
      hole.bezierCurveTo(0.1, -0.41, 0.12, -0.73, 0, -0.73);
      hole.bezierCurveTo(-0.12, -0.73, -0.11, -0.27, -0.29, -0.18);
      hole.bezierCurveTo(-0.41, -0.1, -0.73, -0.12, -0.73, 0);
      hole.bezierCurveTo(-0.73, 0.12, -0.27, 0.11, -0.18, 0.29);
      hole.bezierCurveTo(-0.1, 0.41, -0.12, 0.73, 0, 0.73);
      shape.holes.push(hole);
      break;
    }
    case 4:
      for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2;
        const points = [[0, 0.13], [0.27, 0.4], [0, 0.72], [-0.27, 0.4]].map(([x, y]) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)]);
        shape.holes.push(roundedPolygon(points, 0.08));
      }
      break;
    case 5:
      shape.holes.push(clover(0.55, 0.12, Math.PI));
      break;
  }

  const raw = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelSegments: 8,
    steps: 1,
    bevelSize: 0.065,
    bevelThickness: 0.065,
    curveSegments: 64,
  });
  raw.translate(0, 0, -0.08);
  // Smooth the bevels without changing the holes or adding heavyweight assets.
  raw.deleteAttribute('normal');
  const geometry = mergeVertices(raw, 0.0001);
  geometry.computeVertexNormals();
  raw.dispose();
  return geometry;
}

export function createCoin(index, material) {
  const group = new THREE.Group();
  const face = new THREE.Mesh(createCoinGeometry(index), material);
  group.add(face);
  const rimGeometry = new THREE.TorusGeometry(0.982, 0.022, 10, 128);
  for (const z of [-0.096, 0.096]) {
    const rim = new THREE.Mesh(rimGeometry, material);
    rim.position.z = z;
    group.add(rim);
  }
  if (index === 0 || index === 5) {
    const hub = new THREE.Mesh(new THREE.SphereGeometry(index === 0 ? 0.12 : 0.2, 32, 20), material);
    hub.scale.z = 0.66;
    group.add(hub);
  }
  return group;
}
