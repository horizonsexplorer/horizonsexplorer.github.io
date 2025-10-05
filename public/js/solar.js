// solar.js - Developed by Abdulwahab Almusailem
/* global THREE */

// ================== Basic Parallax for CSS Sun (kept) ==================
document.addEventListener('mousemove', e => {
  const cx = (e.clientX / innerWidth - .5);
  const cy = (e.clientY / innerHeight - .5);
  const sun = document.querySelector('.sun');
  if (sun) sun.style.transform = `translate(${cx*8}px, ${cy*6}px)`; // softer
});

// ================== 3D Scene ==================
(() => {
  const container = document.getElementById('hero3d');
  if (!container) return;
  if (typeof THREE === 'undefined') {
    console.error('THREE.js not found. Include three.min.js before this file.');
    return;
  }

  // --- Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; // r150+
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  container.appendChild(renderer.domElement);

  // --- Scene & Camera (around 45 degs top view)
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 5000);
  camera.position.set(12, 110, 110);
  camera.lookAt(0, 0, 0);

  // --- Lights
  scene.add(new THREE.HemisphereLight(0x86aaff, 0x0a0f18, 0.55));
  const key = new THREE.PointLight(0xffefc0, 1.25, 0, 2);
  key.position.set(-260, 140, -160);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8ac6ff, 0.55);
  fill.position.set(160, 90, 220);
  scene.add(fill);

  // --- Background (dark dome) 
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(2000, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0x02060e,
      side: THREE.BackSide,
      depthWrite: false   
    })
  ));

  // --- Star dots (two layers of THREE.Points) INSIDE the dome
  const starGroup = new THREE.Group();
  scene.add(starGroup);

  function makeStarCloud({
    count = 2200,
    radiusMin = 900,
    radiusMax = 1500,
    size = 2.2,
    opacity = 0.85,
    color = 0x9fcfff
  } = {}) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // random direction
      let x = Math.random() * 2 - 1;
      let y = Math.random() * 2 - 1;
      let z = Math.random() * 2 - 1;
      const len = Math.hypot(x, y, z) || 1;
      x /= len; y /= len; z /= len;
      // random radius in shell (inside the sky dome)
      const r = radiusMin + Math.random() * (radiusMax - radiusMin);
      positions[i*3 + 0] = x * r;
      positions[i*3 + 1] = y * r;
      positions[i*3 + 2] = z * r;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size,
      sizeAttenuation: false, // crisp pixel-like stars regardless of distance
      transparent: true,
      opacity,
      depthWrite: false,      
      depthTest: true
    });
    const pts = new THREE.Points(geom, mat);
    pts.frustumCulled = false;
    return pts;
  }

  // Far (smaller/dimmer) + near (slightly larger/brighter) layers
  const starsFar  = makeStarCloud({ count: 2600, radiusMin: 1100, radiusMax: 1600, size: 1.8, opacity: 0.6,  color: 0x8fb7ff });
  const starsNear = makeStarCloud({ count: 1800, radiusMin: 900,  radiusMax: 1300, size: 2.4, opacity: 0.9,  color: 0xcfe6ff });
  starGroup.add(starsFar, starsNear);

  // --- Texture loader
  const loader = new THREE.TextureLoader();
  const loadTex = (url, cb) =>
    loader.load(url, tex => { tex.colorSpace = THREE.SRGBColorSpace; cb(tex); },
      undefined, () => cb(null));

  // --- Helpers
  function makePlanet(radius, color) {
    const geo = new THREE.SphereGeometry(radius, 64, 64);
    const mat = new THREE.MeshPhongMaterial({ color, shininess: 8, specular: 0x111111 });
    return new THREE.Mesh(geo, mat);
  }

  // Build an ellipse line (XZ plane) with radii rx & rz
  function makeEllipseLine(rx, rz, color = 0x9fe7ff, opacity = 0.42, segments = 720) {
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(a) * rx, 0, Math.sin(a) * rz));
    }
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const line = new THREE.Line(geom, mat);
    line.frustumCulled = false;
    return line;
  }

  // --- System group (slight right shift to balance with CSS sun on the left)
  const group = new THREE.Group();
  scene.add(group);
  group.position.set(8, 0, 0);

  // --- Sizes (planets slightly smaller)
  const EARTH_R = 9;
  const MARS_R  = 7;

  // --- Orbit radii (wider) and flatten factor for ellipse
  const FLATTEN = 0.38;        // ellipse Z flatten factor
  const EARTH_RX = 60, EARTH_RZ = EARTH_RX * FLATTEN;
  const MARS_RX  = 95, MARS_RZ  = MARS_RX  * FLATTEN;

  // --- Bodies
  const earth = makePlanet(EARTH_R, 0x3ba2ff);
  const mars  = makePlanet(MARS_R,  0xc86a3b);

  // Orbits (true ellipses -> always align)
  const earthOrbit = makeEllipseLine(EARTH_RX, EARTH_RZ, 0xa7f0ff, 0.58);
  const marsOrbit  = makeEllipseLine(MARS_RX,  MARS_RZ,  0xffbc97, 0.58);

  group.add(earthOrbit, marsOrbit, earth, mars);

  // --- Transparent 3D Sun in the center
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(16, 64, 64),
    new THREE.MeshBasicMaterial({
      color: 0xffd591,
      transparent: true,
      opacity: 0.22,         // see-through
      depthWrite: false,     
      blending: THREE.AdditiveBlending
    })
  );
  sun.position.set(0, 0, 0);
  sun.renderOrder = 0;  // render first
  group.add(sun);

  // Planets / orbits rendering order (ensure clarity)
  earth.renderOrder = mars.renderOrder = 1;
  earthOrbit.renderOrder = marsOrbit.renderOrder = 0.95;

  // --- Textures
  loadTex('assets/textures/earth.jpeg', tex => {
    if (tex) {
      earth.material.dispose();
      earth.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0.0 });
    }
  });
  loadTex('assets/textures/mars.jpg', tex => {
    if (tex) {
      mars.material.dispose();
      mars.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0.0 });
    }
  });

  // --- Label positioning
  function placeLabel(mesh, id) {
    const el = document.getElementById(id);
    if (!el) return;
    const v = mesh.position.clone().project(camera);
    const x = (v.x * 0.5 + 0.5) * container.clientWidth;
    const y = (-v.y * 0.5 + 0.5) * container.clientHeight;
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.display = (v.z < 1 && v.z > -1) ? 'block' : 'none';
  }
  document.getElementById('label-earth')?.addEventListener('click', () => (location.href = 'earth.html'));
  document.getElementById('label-mars') ?.addEventListener('click', () => (location.href = 'mars.html'));

  // --- Hover tooltip (follows mouse)
  const tooltip = document.createElement('div');
  tooltip.style.position = 'absolute';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.zIndex = '10';
  tooltip.style.padding = '8px 10px';
  tooltip.style.borderRadius = '10px';
  tooltip.style.backdropFilter = 'blur(6px)';
  tooltip.style.background = 'rgba(8, 16, 32, 0.55)';
  tooltip.style.border = '1px solid rgba(180, 230, 255, 0.25)';
  tooltip.style.color = '#dff';
  tooltip.style.font = '600 12px/1.25 system-ui, sans-serif';
  tooltip.style.boxShadow = '0 6px 18px rgba(0,0,0,.35)';
  tooltip.style.display = 'none';
  container.appendChild(tooltip);

  const INFO = {
    earth: `<b>Earth</b><br>3rd planet • Radius ~6,371 km<br>Day ≈ 24 h • Year ≈ 365 d`,
    mars:  `<b>Mars</b><br>4th planet • Radius ~3,389 km<br>Day ≈ 24.6 h • 2 moons`
  };

  // --- Interaction (hover & click)
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null;

  function onPointerMove(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // position tooltip near cursor
    const offset = 14;
    tooltip.style.left = `${e.clientX - rect.left + offset}px`;
    tooltip.style.top  = `${e.clientY - rect.top  + offset}px`;
  }
  function onClick() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([earth, mars], false);
    if (hits.length) {
      if (hits[0].object === earth) location.href = 'earth.html';
      else location.href = 'mars.html';
    }
  }
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('click', onClick);

  // --- Animate
  const clock = new THREE.Clock();
  earth.userData = { angle: Math.random() * Math.PI * 2, speed: 0.12 };
  mars.userData  = { angle: Math.random() * Math.PI * 2, speed: 0.08 };

  function animate() {
    const dt = Math.min(clock.getDelta(), 0.033);
    const t  = clock.elapsedTime;

    // Gentle star drift for parallax feel
    starGroup.rotation.y += 0.002 * dt * 60/60;
    starGroup.rotation.x += 0.001 * dt * 60/60;

    // Update angles
    earth.userData.angle += earth.userData.speed * dt;
    mars.userData.angle  += mars.userData.speed  * dt;

    // Positions (match ellipse radii)
    earth.position.set(
      Math.cos(earth.userData.angle) * EARTH_RX,
      Math.sin(earth.userData.angle * 0.55) * 1.0,
      Math.sin(earth.userData.angle) * EARTH_RZ
    );
    mars.position.set(
      Math.cos(mars.userData.angle) * MARS_RX,
      Math.sin(mars.userData.angle * 0.45) * 0.9,
      Math.sin(mars.userData.angle) * MARS_RZ
    );

    // Spins
    earth.rotation.y += 0.22 * dt;
    mars.rotation.y  += 0.18 * dt;

    // Subtle camera float
    camera.position.x = 12 + Math.sin(t * 0.15) * 2;
    camera.position.y = 110 + Math.cos(t * 0.10) * 1.4;
    camera.position.z = 110 + Math.sin(t * 0.12) * 1.4;
    camera.lookAt(group.position);

    // Hover feedback + tooltip
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([earth, mars], false);
    const nowHover = hits.length ? hits[0].object : null;

    if (nowHover !== hovered) {
      [earth, mars].forEach(obj => {
        const m = obj.material;
        if (m && 'emissive' in m) m.emissive.setHex(0x000000);
      });
      if (nowHover && nowHover.material && 'emissive' in nowHover.material) {
        nowHover.material.emissive.setHex(0x133a66);
      }
      hovered = nowHover;
      renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';

      if (hovered === earth) {
        tooltip.innerHTML = INFO.earth;
        tooltip.style.display = 'block';
      } else if (hovered === mars) {
        tooltip.innerHTML = INFO.mars;
        tooltip.style.display = 'block';
      } else {
        tooltip.style.display = 'none';
      }
    }

    // Labels
    placeLabel(earth, 'label-earth');
    placeLabel(mars,  'label-mars');

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  // --- Resize
  function onResize() {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', onResize);
  onResize();
})();
