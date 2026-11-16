
// =====================================================================
//  Grey Model 3-style sedan parked on each driveway (≈15'-8" long, 6'-1" wide, 4'-8" tall)
//  Built along +x (nose) — rotate the returned group to park it.
// =====================================================================
const SEDAN = {
  paint: new THREE.MeshPhysicalMaterial({ color: '#a7aaaf', metalness: .35, roughness: .32, clearcoat: 1, clearcoatRoughness: .1 }),
  glass: new THREE.MeshPhysicalMaterial({ color: '#0f1215', metalness: .3, roughness: .05, clearcoat: 1 }),
  tire: std({ color: '#151617', roughness: .9 }),
  rim: std({ color: '#9ea2a6', metalness: .8, roughness: .3 }),
  head: new THREE.MeshBasicMaterial({ color: '#f4f6ff' }),
  tail: new THREE.MeshBasicMaterial({ color: '#c3141c' }),
  trim: std({ color: '#1a1b1d', roughness: .5 }),
};
function sedanSide(pts, width, bevel) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: width - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .8, bevelSegments: 4, curveSegments: 8 });
  g.translate(0, 0, -(width - 2 * bevel) / 2); g.computeVertexNormals();
  return g;
}
function makeSedan() {
  const car = new THREE.Group();
  // lower body up to the beltline
  const body = new THREE.Mesh(sedanSide([[-7.75, .6], [7.7, .6], [7.95, 1.35], [7.7, 2.15], [6.2, 2.55], [3.1, 2.95], [-5.9, 3.25], [-7.55, 3.2], [-7.95, 2.45], [-7.9, 1.2]], 6.0, .35), SEDAN.paint);
  // one-piece dark glass greenhouse (windshield, glass roof, rear glass), slightly narrower for tumblehome
  const cab = new THREE.Mesh(sedanSide([[3.25, 2.9], [.55, 4.55], [-2.5, 4.62], [-6.0, 3.28], [-5.6, 3.05], [2.9, 2.85]], 5.1, .3), SEDAN.glass);
  car.add(body, cab);
  // wheels: tyre + flat aero rim on the outer face
  for (const x of [4.75, -4.75]) for (const z of [-2.62, 2.62]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, .8, 24), SEDAN.tire); t.rotation.x = Math.PI / 2; t.position.set(x, 1.15, z); car.add(t);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(.82, .82, .06, 24), SEDAN.rim); r.rotation.x = Math.PI / 2; r.position.set(x, 1.15, z + Math.sign(z) * .42); car.add(r);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .08, 12), SEDAN.trim); hub.rotation.x = Math.PI / 2; hub.position.set(x, 1.15, z + Math.sign(z) * .46); car.add(hub);
  }
  // headlight and full-width-style tail light strips, mirrors, door handles line
  for (const z of [-2.15, 2.15]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(.25, .16, 1.2), SEDAN.head); h.position.set(7.72, 2.0, z); h.rotation.z = -.35; car.add(h);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(.12, .3, 1.5), SEDAN.tail); tl.position.set(-7.88, 2.75, z * .95); car.add(tl);
    const m = new THREE.Mesh(new THREE.BoxGeometry(.5, .3, .45), SEDAN.paint); m.position.set(2.6, 3.05, z * 1.42); car.add(m);
  }
  const lip = new THREE.Mesh(new THREE.BoxGeometry(.3, .25, 5.0), SEDAN.trim); lip.position.set(7.8, .78, 0); car.add(lip);
  car.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return car;
}
function parkSedan(parent, x, z, yaw) {
  const g = new THREE.Group(), car = makeSedan();
  car.rotation.y = yaw; car.position.set(x, .12, z); g.add(car); parent.add(g);
  const c = Math.abs(Math.cos(yaw)) > .5, hx = c ? 8 : 3.1, hz = c ? 3.1 : 8;
  const k = box(g, x - hx, x + hx, 0, 4.6, z - hz, z + hz, M.glass, { solid: true, cast: false }); k.visible = false; k.userData.ghost = true;
}
// House 1: Bay Street driveway, nose toward the side garage doors
parkSedan(G.site, 66, 8.25, Math.PI);
// House 2: front driveway, nose toward the street-facing garage door
parkSedan(G2.site, 41.5, -34, -Math.PI / 2);
