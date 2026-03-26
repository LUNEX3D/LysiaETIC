import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const World3D = () => {
    const mountRef = useRef(null);

    useEffect(() => {
        const getSize = () => {
            const width = mountRef.current?.clientWidth || window.innerWidth;
            const height = mountRef.current?.clientHeight || window.innerHeight;
            return { width, height };
        };

        const { width, height } = getSize();
        // Sahne, Kamera ve Renderer
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio || 1);

        if (mountRef.current) {
            mountRef.current.appendChild(renderer.domElement);
        }

        // Dünya için texture yükle
        const earthTexture = new THREE.TextureLoader().load("https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg");
        const earth = new THREE.Mesh(
            new THREE.SphereGeometry(4, 64, 64),
            new THREE.MeshPhongMaterial({ map: earthTexture })
        );
        scene.add(earth);

        // Uzay Arka Planı (Yıldızlar)
        const starGeometry = new THREE.BufferGeometry();
        const starVertices = [];
        for (let i = 0; i < 10000; i++) {
            const x = THREE.MathUtils.randFloatSpread(2000);
            const y = THREE.MathUtils.randFloatSpread(2000);
            const z = THREE.MathUtils.randFloatSpread(2000);
            starVertices.push(x, y, z);
        }
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        const stars = new THREE.Points(
            starGeometry,
            new THREE.PointsMaterial({ color: 0xFFFFFF, size: 0.7 })
        );
        scene.add(stars);

        // Mars Gezegeni (Düz Renk ile)
        const mars = new THREE.Mesh(
            new THREE.SphereGeometry(1.5, 32, 32),
            new THREE.MeshPhongMaterial({ color: 0xFF4500 }) // Mars'ın karakteristik rengi
        );
        mars.position.set(25, 5, -30);
        scene.add(mars);

        // Işık
        const light = new THREE.DirectionalLight(0xffffff, 1.5);
        light.position.set(5, 3, 5);
        scene.add(light);

        // Kamera
        camera.position.z = 15;

        // Kontroller
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableZoom = true;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;

        // Animasyon
        const animate = () => {
            requestAnimationFrame(animate);
            earth.rotation.y += 0.0015;
            mars.rotation.y += 0.001;
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        const handleResize = () => {
            const { width: nextWidth, height: nextHeight } = getSize();
            camera.aspect = nextWidth / nextHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(nextWidth, nextHeight);
        };

        window.addEventListener("resize", handleResize);

        // Temizleme
        return () => {
            window.removeEventListener("resize", handleResize);
            if (mountRef.current) {
                mountRef.current.removeChild(renderer.domElement);
            }
        };
    }, []);

    return <div ref={mountRef} className="world3d" />;
};

export default World3D;
