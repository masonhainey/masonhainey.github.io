/* Certification coins: each certificate becomes a glossy, gold-rimmed 3D coin that spins.
   One shared WebGL renderer draws every visible coin, then copies the frame into that card's canvas. */
(function () {
  const cards = [...document.querySelectorAll(".cert")];
  if (!cards.length || !window.THREE) return;
  const T = THREE;

  let renderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { return; }
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = .9;
  renderer.setClearColor(0x000000, 0);

  // studio environment, same idea as the Block U: gradient room plus softboxes for moving highlights
  const envScene = new T.Scene(), skyGeo = new T.SphereGeometry(50, 32, 24), col = [], sp = skyGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const h = sp.getY(i) / 50, c = new T.Color();
    if (h > 0) c.setRGB(.2, .2, .23).lerp(new T.Color(.55, .55, .6), Math.min(h / .8, 1));
    else c.setRGB(.16, .14, .12).lerp(new T.Color(.04, .04, .04), Math.min(-h / .5, 1));
    col.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute("color", new T.Float32BufferAttribute(col, 3));
  envScene.add(new T.Mesh(skyGeo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
  const softbox = (w, h, pos, v) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(v, v, v), side: T.DoubleSide })); m.position.set(...pos); m.lookAt(0, 0, 0); envScene.add(m); };
  softbox(26, 40, [-34, 16, 26], 8); softbox(60, 16, [0, 45, 8], 4); softbox(8, 50, [40, 4, -16], 5);
  const env = new T.PMREMGenerator(renderer).fromScene(envScene, .02).texture;

  const scene = new T.Scene();
  scene.environment = env;
  const key = new T.DirectionalLight(0xfff1dc, 1.1); key.position.set(-3, 4, 5); scene.add(key);
  scene.add(new T.HemisphereLight(0xffffff, 0x221a10, .25));
  const camera = new T.PerspectiveCamera(24, 1, .1, 100);

  // Mario-coin gold for the rim and bevel
  const gold = new T.MeshPhysicalMaterial({ color: 0xf5c04a, metalness: 1, roughness: .2, clearcoat: 1, clearcoatRoughness: .08 });
  const loader = new T.TextureLoader();
  // rest facing the viewer, then make a smooth half turn to the other side
  const REST = 4, TURN = 3.2, CYCLE = REST + TURN;
  const ease = t => (1 - Math.cos(Math.PI * t)) / 2;

  function roundRect(w, h, r) {
    const s = new T.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function circle(d) { const s = new T.Shape(); s.absarc(0, 0, d / 2, 0, Math.PI * 2, false); return s; }

  // face geometry with UVs stretched over the shape's bounding box
  function faceGeo(shape, w, h) {
    const g = new T.ShapeGeometry(shape, 48), p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
    return g;
  }

  function wrap(ctx, text, maxW) {
    const words = text.split(" "), lines = []; let line = "";
    words.forEach(wd => { const t = line ? line + " " + wd : wd; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = wd; } else line = t; });
    lines.push(line); return lines;
  }
  // back of the coin: certificate name and issuer on the badge's own colour
  function backTexture(card, w, h) {
    const W = 1024, H = Math.round(W * h / w), cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d"), a = card.dataset.accent;
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, a); g.addColorStop(1, "#111");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle";
    const round = card.dataset.shape === "circle";
    c.font = '700 44px "Plus Jakarta Sans", system-ui, sans-serif';
    c.globalAlpha = .8; c.fillText(card.dataset.issuer.toUpperCase(), W / 2, H * (round ? .3 : .26)); c.globalAlpha = 1;
    c.font = '600 92px "Newsreader", Georgia, serif';
    const lines = wrap(c, card.dataset.title, W * (round ? .62 : .8)), lh = 100, y0 = H / 2 - (lines.length - 1) * lh / 2 + 20;
    lines.forEach((l, i) => c.fillText(l, W / 2, y0 + i * lh));
    c.font = '700 40px "Plus Jakarta Sans", system-ui, sans-serif'; c.globalAlpha = .75;
    c.fillText("MASON HAINEY", W / 2, H * (round ? .76 : .8));
    const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t;
  }

  const coins = cards.map((card, idx) => {
    // shapes: rounded rectangle (certificates), circle (round badges) or the badge's own outline ("poly")
    const kind = card.dataset.shape, round = kind !== "rect", aspect = +card.dataset.aspect || 1;
    let shape, w = 2, h = 2;
    if (kind === "circle") shape = circle(2);
    else if (kind === "poly") {
      const pts = card.dataset.poly.split(";").map(p => p.split(",").map(Number));
      shape = new T.Shape(pts.map(([x, y]) => new T.Vector2(x, y)));
      h = Math.max(...pts.map(p => p[1])) - Math.min(...pts.map(p => p[1]));
    } else { h = 2 / aspect; shape = roundRect(w, h, .1); }
    const depth = round ? .16 : .1, bevel = round ? .07 : .045, curveSegments = kind === "poly" ? 1 : 64;
    const body = new T.Mesh(new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 6, curveSegments }), gold);
    body.geometry.center();
    const zFace = depth / 2 + bevel + .002;
    const tex = loader.load(card.querySelector("img").src, () => card.dataset.ready = 1);
    tex.encoding = T.sRGBEncoding; tex.anisotropy = 8;
    const glossy = map => new T.MeshPhysicalMaterial({ map, roughness: .32, metalness: 0, clearcoat: 1, clearcoatRoughness: .04, transparent: round, envMapIntensity: .5 });
    const front = new T.Mesh(faceGeo(shape, w, h), glossy(tex)); front.position.z = zFace;
    const back = new T.Mesh(faceGeo(shape, w, h), glossy(backTexture(card, w, h))); back.position.z = -zFace; back.rotation.y = Math.PI;
    const coin = new T.Group(); coin.add(body, front, back); coin.visible = false; scene.add(coin);

    const cv = card.querySelector("canvas"), ctx = cv.getContext("2d");
    const st = { card, coin, cv, ctx, idx, clock: idx * 1.7, shown: 0, hold: false, visible: false, size: Math.max(w, h + .4) };
    // hovering (or tapping) turns the coin to its front and holds it still so it can be read
    const release = () => { st.hold = false; st.clock = Math.round(st.shown / Math.PI) * CYCLE; };
    card.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") st.hold = true; });
    card.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") release(); });
    // clicking the coin itself (with a mouse) opens the verification page
    if (card.dataset.href) card.querySelector(".coinbox").addEventListener("click", e => { if (e.pointerType !== "touch") window.open(card.dataset.href, "_blank", "noopener"); });
    card.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse") { st.hold = true; clearTimeout(st.t); st.t = setTimeout(release, 3500); } });
    new IntersectionObserver(([e]) => st.visible = e.isIntersecting, { rootMargin: "100px" }).observe(card);
    return st;
  });
  document.querySelector(".certs").classList.add("gl");

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(now - last, 50) / 1000; last = now;
    coins.forEach(st => {
      let goal;
      if (st.hold) goal = Math.round(st.shown / (2 * Math.PI)) * 2 * Math.PI;
      else {
        st.clock += dt;
        const k = Math.floor(st.clock / CYCLE), c = st.clock - k * CYCLE;
        goal = k * Math.PI + (c < REST ? Math.sin(Math.PI * c / REST) * Math.sin(st.clock * 1.3 + st.idx) * .2 : ease((c - REST) / TURN) * Math.PI);
      }
      st.shown += (goal - st.shown) * Math.min(dt * (st.hold ? 2.5 : 6), 1);
      if (!st.visible) return;
      const r = st.cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (!W || !H) return;
      if (st.cv.width !== W || st.cv.height !== H) { st.cv.width = W; st.cv.height = H; }
      if (renderer.domElement.width !== W || renderer.domElement.height !== H) renderer.setSize(W, H, false);
      camera.aspect = W / H; camera.position.set(0, .35, st.size / Math.tan(T.MathUtils.degToRad(12)) / 2 * 1.08); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
      st.coin.visible = true;
      st.coin.rotation.set(-.08, st.shown, 0);
      st.coin.position.y = Math.sin(now / 1100 + st.idx) * .025;
      renderer.render(scene, camera);
      st.coin.visible = false;
      st.ctx.clearRect(0, 0, W, H); st.ctx.drawImage(renderer.domElement, 0, 0);
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
