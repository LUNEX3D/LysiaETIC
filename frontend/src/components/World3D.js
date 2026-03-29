import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const World3D = () => {
    const mountRef = useRef(null);

    useEffect(() => {
        if (!mountRef.current) return;

        const container = mountRef.current;
        const getSize = () => ({
            width: container.clientWidth || window.innerWidth,
            height: container.clientHeight || window.innerHeight,
        });

        const { width, height } = getSize();

        /* ── Scene ── */
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x020208);

        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 5000);
        camera.position.set(5, 15, 35);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        container.appendChild(renderer.domElement);

        /* ── OrbitControls ── */
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.04;
        controls.enablePan = false;
        controls.rotateSpeed = 0.3;
        controls.zoomSpeed = 0.5;
        controls.minDistance = 10;
        controls.maxDistance = 180;
        controls.target.set(0, 0, 0);
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.18;
        controls.minPolarAngle = 0.3;
        controls.maxPolarAngle = Math.PI - 0.3;

        /* ═══════════════════════════════════════
           STARS — layered for depth
           ═══════════════════════════════════════ */

        // Layer 1: Close bright stars
        const makeStarLayer = (count, minR, maxR, size, opacity) => {
            const geo = new THREE.BufferGeometry();
            const pos = new Float32Array(count * 3);
            const col = new Float32Array(count * 3);
            for (let i = 0; i < count; i++) {
                const i3 = i * 3;
                const r = minR + Math.random() * (maxR - minR);
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                pos[i3]     = r * Math.sin(phi) * Math.cos(theta);
                pos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
                pos[i3 + 2] = r * Math.cos(phi);
                const t = Math.random();
                if (t < 0.4)      { col[i3]=1;   col[i3+1]=1;    col[i3+2]=1;   }
                else if (t < 0.6) { col[i3]=0.7; col[i3+1]=0.85; col[i3+2]=1;   }
                else if (t < 0.75){ col[i3]=1;   col[i3+1]=0.9;  col[i3+2]=0.7; }
                else if (t < 0.88){ col[i3]=0.85;col[i3+1]=0.7;  col[i3+2]=1;   }
                else              { col[i3]=1;   col[i3+1]=0.75; col[i3+2]=0.6; }
            }
            geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
            geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
            return new THREE.Points(geo, new THREE.PointsMaterial({
                size, vertexColors: true, transparent: true, opacity, sizeAttenuation: true
            }));
        };

        const starsNear = makeStarLayer(6000, 150, 600, 0.8, 0.95);
        const starsMid  = makeStarLayer(10000, 400, 1200, 0.45, 0.7);
        const starsFar  = makeStarLayer(8000, 800, 2000, 0.2, 0.45);
        scene.add(starsNear, starsMid, starsFar);

        /* ═══════════════════════════════════════
           NEBULA — soft colored clouds
           ═══════════════════════════════════════ */
        const makeNebula = (count, color, minR, maxR, ySpread, size, opacity) => {
            const geo = new THREE.BufferGeometry();
            const pos = new Float32Array(count * 3);
            for (let i = 0; i < count; i++) {
                const i3 = i * 3;
                const angle = Math.random() * Math.PI * 2;
                const r = minR + Math.random() * (maxR - minR);
                pos[i3]     = Math.cos(angle) * r + THREE.MathUtils.randFloatSpread(r * 0.3);
                pos[i3 + 1] = THREE.MathUtils.randFloatSpread(ySpread);
                pos[i3 + 2] = Math.sin(angle) * r + THREE.MathUtils.randFloatSpread(r * 0.3);
            }
            geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
            return new THREE.Points(geo, new THREE.PointsMaterial({
                size, color, transparent: true, opacity,
                blending: THREE.AdditiveBlending, sizeAttenuation: true, depthWrite: false
            }));
        };

        const neb1 = makeNebula(1000, 0x3366ff, 80, 250, 50, 4.5, 0.04);
        const neb2 = makeNebula(800,  0x9944dd, 100, 220, 40, 5,   0.035);
        const neb3 = makeNebula(600,  0x22ccaa, 120, 280, 55, 4,   0.03);
        const neb4 = makeNebula(500,  0xff3366, 90, 200, 35, 3.5,  0.025);
        scene.add(neb1, neb2, neb3, neb4);

        /* ── Milky Way band ── */
        const milkyGeo = new THREE.BufferGeometry();
        const milkyCount = 6000;
        const mPos = new Float32Array(milkyCount * 3);
        const mCol = new Float32Array(milkyCount * 3);
        for (let i = 0; i < milkyCount; i++) {
            const i3 = i * 3;
            const angle = Math.random() * Math.PI * 2;
            const r = 60 + Math.random() * 500;
            mPos[i3]     = Math.cos(angle) * r;
            mPos[i3 + 1] = THREE.MathUtils.randFloatSpread(8) + Math.sin(angle * 2) * 5;
            mPos[i3 + 2] = Math.sin(angle) * r;
            mCol[i3] = 0.75 + Math.random() * 0.25;
            mCol[i3+1] = 0.8 + Math.random() * 0.2;
            mCol[i3+2] = 0.95 + Math.random() * 0.05;
        }
        milkyGeo.setAttribute("position", new THREE.Float32BufferAttribute(mPos, 3));
        milkyGeo.setAttribute("color", new THREE.Float32BufferAttribute(mCol, 3));
        const milkyWay = new THREE.Points(milkyGeo, new THREE.PointsMaterial({
            size: 0.35, vertexColors: true, transparent: true, opacity: 0.08,
            blending: THREE.AdditiveBlending, sizeAttenuation: true, depthWrite: false
        }));
        milkyWay.rotation.x = 0.25;
        milkyWay.rotation.z = 0.15;
        scene.add(milkyWay);

        /* ═══════════════════════════════════════
           LIGHTS
           ═══════════════════════════════════════ */
        const sunLight = new THREE.PointLight(0xfff0d0, 2.8, 500);
        sunLight.position.set(0, 0, 0);
        scene.add(sunLight);
        scene.add(new THREE.AmbientLight(0x0a0a20, 0.4));

        /* ═══════════════════════════════════════
           HELPERS
           ═══════════════════════════════════════ */
        const createPlanet = (radius, color, emissive, emissiveI = 0, shininess = 25) => {
            const mesh = new THREE.Mesh(
                new THREE.SphereGeometry(radius, 48, 48),
                new THREE.MeshPhongMaterial({
                    color, emissive: emissive || 0x000000,
                    emissiveIntensity: emissiveI, shininess
                })
            );
            return mesh;
        };

        const createOrbit = (radius) => {
            const pts = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0).getPoints(160);
            const geo = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p.x, 0, p.y)));
            return new THREE.Line(geo, new THREE.LineBasicMaterial({
                color: 0x4488cc, transparent: true, opacity: 0.06
            }));
        };

        const makeGlowSprite = (color, innerAlpha, outerAlpha, size) => {
            const c = document.createElement("canvas");
            c.width = 256; c.height = 256;
            const cx = c.getContext("2d");
            const g = cx.createRadialGradient(128, 128, 0, 128, 128, 128);
            g.addColorStop(0, color.replace(")", `,${innerAlpha})`).replace("rgb", "rgba"));
            g.addColorStop(0.3, color.replace(")", `,${innerAlpha * 0.4})`).replace("rgb", "rgba"));
            g.addColorStop(0.6, color.replace(")", `,${outerAlpha})`).replace("rgb", "rgba"));
            g.addColorStop(1, color.replace(")", ",0)").replace("rgb", "rgba"));
            cx.fillStyle = g;
            cx.fillRect(0, 0, 256, 256);
            const tex = new THREE.CanvasTexture(c);
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
            }));
            sprite.scale.set(size, size, 1);
            return sprite;
        };

        /* ═══════════════════════════════════════
           SUN
           ═══════════════════════════════════════ */
        const sun = createPlanet(3, 0xffcc00, 0xffaa00, 2, 5);
        scene.add(sun);

        const sunGlow1 = makeGlowSprite("rgb(255,200,60)", 0.9, 0.02, 24);
        const sunGlow2 = makeGlowSprite("rgb(255,150,30)", 0.3, 0.01, 50);
        scene.add(sunGlow1, sunGlow2);

        /* ═══════════════════════════════════════
           PLANETS
           ═══════════════════════════════════════ */
        const planets = [];

        // Mercury
        const mercury = createPlanet(0.4, 0x888888, 0x111111, 0.05);
        planets.push({ mesh: mercury, orbit: 6, speed: 0.012, angle: Math.random() * 6.28, tilt: 0 });
        scene.add(mercury, createOrbit(6));

        // Venus
        const venus = createPlanet(0.8, 0xddaa55, 0x332200, 0.08);
        planets.push({ mesh: venus, orbit: 9, speed: 0.008, angle: Math.random() * 6.28, tilt: 0.05 });
        scene.add(venus, createOrbit(9));

        // Earth
        const earth = createPlanet(1.0, 0x2255bb, 0x112244, 0.12);
        // Atmosphere shell
        earth.add(new THREE.Mesh(
            new THREE.SphereGeometry(1.15, 48, 48),
            new THREE.MeshPhongMaterial({ color: 0x4488ff, transparent: true, opacity: 0.1, side: THREE.BackSide })
        ));
        // Earth glow
        const earthGlow = makeGlowSprite("rgb(60,120,255)", 0.25, 0.01, 4.5);
        earth.add(earthGlow);
        planets.push({ mesh: earth, orbit: 13, speed: 0.006, angle: 0, tilt: 0.41, isEarth: true });
        scene.add(earth, createOrbit(13));

        // Moon
        const moon = createPlanet(0.18, 0xbbbbbb, 0x111111, 0.02);
        scene.add(moon);

        // Mars
        const mars = createPlanet(0.6, 0xbb3311, 0x331100, 0.08);
        planets.push({ mesh: mars, orbit: 18, speed: 0.004, angle: Math.random() * 6.28, tilt: 0.44 });
        scene.add(mars, createOrbit(18));

        // Asteroid belt
        const astGeo = new THREE.BufferGeometry();
        const astCount = 800;
        const astPos = new Float32Array(astCount * 3);
        for (let i = 0; i < astCount; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = 21 + Math.random() * 4;
            astPos[i*3]   = Math.cos(a) * r + THREE.MathUtils.randFloatSpread(1.2);
            astPos[i*3+1] = THREE.MathUtils.randFloatSpread(1);
            astPos[i*3+2] = Math.sin(a) * r + THREE.MathUtils.randFloatSpread(1.2);
        }
        astGeo.setAttribute("position", new THREE.Float32BufferAttribute(astPos, 3));
        const asteroids = new THREE.Points(astGeo, new THREE.PointsMaterial({
            size: 0.12, color: 0x777777, transparent: true, opacity: 0.4, sizeAttenuation: true
        }));
        scene.add(asteroids);

        // Jupiter
        const jupiter = createPlanet(2.3, 0xc8a070, 0x221100, 0.04);
        planets.push({ mesh: jupiter, orbit: 28, speed: 0.0018, angle: Math.random() * 6.28, tilt: 0.05 });
        scene.add(jupiter, createOrbit(28));

        // Saturn + rings
        const saturn = createPlanet(1.8, 0xddc080, 0x221100, 0.04);
        const sRing = new THREE.Mesh(
            new THREE.RingGeometry(2.4, 4, 64),
            new THREE.MeshBasicMaterial({ color: 0xc8b080, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
        );
        sRing.rotation.x = Math.PI / 2.3;
        saturn.add(sRing);
        planets.push({ mesh: saturn, orbit: 36, speed: 0.001, angle: Math.random() * 6.28, tilt: 0.47 });
        scene.add(saturn, createOrbit(36));

        // Uranus
        const uranus = createPlanet(1.1, 0x55bbbb, 0x113333, 0.08);
        planets.push({ mesh: uranus, orbit: 46, speed: 0.0007, angle: Math.random() * 6.28, tilt: 0.97 });
        scene.add(uranus, createOrbit(46));

        // Neptune
        const neptune = createPlanet(1.05, 0x3344bb, 0x111144, 0.1);
        planets.push({ mesh: neptune, orbit: 54, speed: 0.0004, angle: Math.random() * 6.28, tilt: 0.49 });
        scene.add(neptune, createOrbit(54));

        /* ═══════════════════════════════════════
           SHOOTING STARS
           ═══════════════════════════════════════ */
        const shooters = [];
        for (let i = 0; i < 4; i++) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(6), 3));
            const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
            const line = new THREE.Line(geo, mat);
            scene.add(line);
            shooters.push({ line, active: false, timer: 50 + Math.random() * 250, speed: 0, dir: new THREE.Vector3() });
        }

        /* ═══════════════════════════════════════
           ANIMATION LOOP
           ═══════════════════════════════════════ */
        const clock = new THREE.Clock();
        let moonAngle = 0;
        let animId;

        const animate = () => {
            animId = requestAnimationFrame(animate);
            const t = clock.getElapsedTime();

            // Sun rotation + glow pulse
            sun.rotation.y = t * 0.06;
            const p = 1 + Math.sin(t * 1.2) * 0.05;
            sunGlow1.scale.set(24 * p, 24 * p, 1);
            sunGlow2.scale.set(50 * p, 50 * p, 1);

            // Planets orbit
            planets.forEach(pl => {
                pl.angle += pl.speed;
                pl.mesh.position.x = Math.cos(pl.angle) * pl.orbit;
                pl.mesh.position.z = Math.sin(pl.angle) * pl.orbit;
                pl.mesh.position.y = Math.sin(pl.angle * 0.5) * pl.tilt * 1.2;
                pl.mesh.rotation.y += 0.003;
            });

            // Moon
            moonAngle += 0.025;
            moon.position.x = earth.position.x + Math.cos(moonAngle) * 2;
            moon.position.z = earth.position.z + Math.sin(moonAngle) * 2;
            moon.position.y = earth.position.y + Math.sin(moonAngle * 0.7) * 0.25;

            // Slow rotations
            asteroids.rotation.y += 0.0002;
            neb1.rotation.y = t * 0.003;
            neb2.rotation.y = -t * 0.002;
            neb3.rotation.y = t * 0.0025;
            neb4.rotation.y = -t * 0.0015;
            milkyWay.rotation.y = t * 0.001;
            starsNear.rotation.y = t * 0.0004;
            starsMid.rotation.y = -t * 0.0002;

            // Shooting stars
            shooters.forEach(s => {
                if (!s.active) {
                    s.timer--;
                    if (s.timer <= 0) {
                        s.active = true;
                        s.timer = 25 + Math.random() * 20;
                        s.speed = 2.5 + Math.random() * 3;
                        const start = new THREE.Vector3(
                            THREE.MathUtils.randFloatSpread(150),
                            40 + Math.random() * 80,
                            THREE.MathUtils.randFloatSpread(150)
                        );
                        s.dir.set(THREE.MathUtils.randFloatSpread(0.8), -0.6 - Math.random() * 0.4, THREE.MathUtils.randFloatSpread(0.8)).normalize();
                        const arr = s.line.geometry.attributes.position.array;
                        arr[0]=start.x; arr[1]=start.y; arr[2]=start.z;
                        arr[3]=start.x; arr[4]=start.y; arr[5]=start.z;
                        s.line.geometry.attributes.position.needsUpdate = true;
                        s.line.material.opacity = 0.7;
                    }
                } else {
                    const arr = s.line.geometry.attributes.position.array;
                    arr[0] += s.dir.x * s.speed;
                    arr[1] += s.dir.y * s.speed;
                    arr[2] += s.dir.z * s.speed;
                    arr[3] += s.dir.x * s.speed * 0.5;
                    arr[4] += s.dir.y * s.speed * 0.5;
                    arr[5] += s.dir.z * s.speed * 0.5;
                    s.line.geometry.attributes.position.needsUpdate = true;
                    s.timer--;
                    s.line.material.opacity = Math.max(0, s.timer / 25) * 0.7;
                    if (s.timer <= 0) {
                        s.active = false;
                        s.timer = 80 + Math.random() * 300;
                        s.line.material.opacity = 0;
                    }
                }
            });

            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        /* ── Resize ── */
        const onResize = () => {
            const { width: w, height: h } = getSize();
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener("resize", onResize);

        /* ── Cleanup ── */
        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener("resize", onResize);
            controls.dispose();
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
    }, []);

    return <div ref={mountRef} className="world3d" />;
};

export default World3D;
