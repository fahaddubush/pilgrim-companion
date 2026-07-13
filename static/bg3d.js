/**
 * 3D Animated Background with soft glowing orbs
 * Matches the original aesthetic but with smooth 3D movement
 */

let scene, camera, renderer, orbs = [];
let mouseX = 0, mouseY = 0;
let targetMouseX = 0, targetMouseY = 0;
let rippleEffect = { active: false, startTime: 0, intensity: 0 };

const config = {
    colors: [
        { r: 0.17, g: 0.62, b: 1.0 },   // blue
        { r: 0.37, g: 0.85, b: 0.7 },   // mint
        { r: 0.35, g: 0.98, b: 0.84 },  // cyan
        { r: 0.53, g: 0.55, b: 1.0 },   // purple-blue
        { r: 0.6, g: 0.4, b: 1.0 },     // purple
        { r: 0.2, g: 0.8, b: 0.9 },     // turquoise
    ],
};

function init() {
    // Add canvas directly to body for full coverage
    scene = new THREE.Scene();
    
    // Orthographic camera for 2D-like feel
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.OrthographicCamera(-10 * aspect, 10 * aspect, 10, -10, 0.1, 100);
    camera.position.z = 10;
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ 
        alpha: true, 
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    
    // Style and insert BEFORE everything else in body
    const canvas = renderer.domElement;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '1';
    canvas.style.pointerEvents = 'none';
    document.body.insertBefore(canvas, document.body.firstChild);
    
    // Create soft glowing orbs
    createOrbs();
    
    // Events
    window.addEventListener('resize', onResize);
    document.addEventListener('mousemove', onMouseMove);
    
    // Start
    animate();
}

function createOrbs() {
    // Many orbs spread across the entire screen
    const orbConfigs = [
        // Left side
        { x: -12, y: 6, z: 0, size: 7, color: 0, speed: 0.4 },
        { x: -8, y: -4, z: -1, size: 5, color: 1, speed: 0.35 },
        { x: -14, y: 0, z: -2, size: 6, color: 4, speed: 0.3 },
        { x: -10, y: -8, z: 0, size: 4, color: 2, speed: 0.45 },
        { x: -16, y: 3, z: -1, size: 5, color: 5, speed: 0.38 },
        // Center-left
        { x: -5, y: 7, z: 0, size: 6, color: 3, speed: 0.42 },
        { x: -3, y: -3, z: -2, size: 4, color: 0, speed: 0.36 },
        { x: -6, y: 1, z: -1, size: 5, color: 1, speed: 0.4 },
        // Center
        { x: 0, y: 8, z: 0, size: 8, color: 2, speed: 0.45 },
        { x: -2, y: -6, z: -1, size: 6, color: 3, speed: 0.38 },
        { x: 3, y: 2, z: 0, size: 5, color: 5, speed: 0.42 },
        { x: 1, y: -9, z: -2, size: 4, color: 4, speed: 0.33 },
        { x: -1, y: 4, z: 0, size: 3, color: 0, speed: 0.48 },
        // Center-right
        { x: 5, y: -2, z: -1, size: 5, color: 1, speed: 0.37 },
        { x: 7, y: 6, z: 0, size: 4, color: 2, speed: 0.44 },
        { x: 4, y: -7, z: -2, size: 6, color: 5, speed: 0.31 },
        // Right side
        { x: 10, y: -5, z: -2, size: 9, color: 1, speed: 0.3 },
        { x: 12, y: 4, z: -1, size: 6, color: 0, speed: 0.36 },
        { x: 15, y: -2, z: 0, size: 5, color: 2, speed: 0.4 },
        { x: 11, y: 8, z: -1, size: 4, color: 3, speed: 0.43 },
        { x: 16, y: -7, z: -2, size: 5, color: 4, speed: 0.35 },
        // Corners and edges
        { x: -15, y: -8, z: -1, size: 7, color: 3, speed: 0.32 },
        { x: 14, y: 8, z: -2, size: 6, color: 4, speed: 0.28 },
        { x: -17, y: -5, z: 0, size: 4, color: 5, speed: 0.39 },
        { x: 17, y: 0, z: -1, size: 5, color: 0, speed: 0.34 },
        { x: -13, y: 9, z: -2, size: 5, color: 1, speed: 0.41 },
        { x: 13, y: -9, z: 0, size: 4, color: 2, speed: 0.46 },
    ];

    orbConfigs.forEach((cfg, i) => {
        // Create a plane with a radial gradient texture
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        const color = config.colors[cfg.color];
        const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        gradient.addColorStop(0, `rgba(${Math.floor(color.r*255)}, ${Math.floor(color.g*255)}, ${Math.floor(color.b*255)}, 0.6)`);
        gradient.addColorStop(0.4, `rgba(${Math.floor(color.r*255)}, ${Math.floor(color.g*255)}, ${Math.floor(color.b*255)}, 0.3)`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 256);
        
        const texture = new THREE.CanvasTexture(canvas);
        
        const geometry = new THREE.PlaneGeometry(cfg.size, cfg.size);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        
        const orb = new THREE.Mesh(geometry, material);
        orb.position.set(cfg.x, cfg.y, cfg.z);
        
        orb.userData = {
            originalX: cfg.x,
            originalY: cfg.y,
            phaseX: Math.random() * Math.PI * 2,
            phaseY: Math.random() * Math.PI * 2,
            speed: cfg.speed,
            amplitudeX: 2 + Math.random() * 1.5,
            amplitudeY: 1.5 + Math.random() * 1,
        };
        
        orbs.push(orb);
        scene.add(orb);
    });
}

function animate() {
    requestAnimationFrame(animate);
    
    const time = Date.now() * 0.0003;
    const now = Date.now();
    
    // Much slower, smoother mouse following
    mouseX += (targetMouseX - mouseX) * 0.015;
    mouseY += (targetMouseY - mouseY) * 0.015;
    
    // Calculate ripple effect
    let rippleIntensity = 0;
    if (rippleEffect.active) {
        const elapsed = now - rippleEffect.startTime;
        const duration = 1800; // 1.8 seconds - longer for visibility
        if (elapsed < duration) {
            // Elastic ease-out for more dramatic effect
            const progress = elapsed / duration;
            const eased = 1 - Math.pow(1 - progress, 3);
            rippleIntensity = rippleEffect.intensity * (1 - eased);
        } else {
            rippleEffect.active = false;
        }
    }
    
    // Animate orbs
    orbs.forEach((orb, i) => {
        const data = orb.userData;
        
        // Gentle floating motion
        orb.position.x = data.originalX + Math.sin(time * data.speed + data.phaseX) * data.amplitudeX;
        orb.position.y = data.originalY + Math.cos(time * data.speed * 0.7 + data.phaseY) * data.amplitudeY;
        
        // Subtle mouse parallax (different layers move differently)
        const parallaxStrength = 0.001 * (i + 1);
        orb.position.x += mouseX * parallaxStrength;
        orb.position.y -= mouseY * parallaxStrength;
        
        // Ripple effect - orbs expand outward and pulse dramatically
        if (rippleIntensity > 0) {
            // Wave-like motion outward from center
            const distFromCenter = Math.sqrt(data.originalX * data.originalX + data.originalY * data.originalY);
            const angle = Math.atan2(data.originalY, data.originalX);
            const waveOffset = Math.sin(time * 15 + i * 0.8) * rippleIntensity * 2;
            
            // Push orbs outward from center
            const outwardForce = rippleIntensity * 3;
            orb.position.x += Math.cos(angle) * outwardForce + waveOffset * 0.5;
            orb.position.y += Math.sin(angle) * outwardForce + waveOffset * 0.3;
        }
        
        // Gentle pulse (much more enhanced during ripple)
        const basePulse = Math.sin(time * 0.5 + i) * 0.05;
        const ripplePulse = rippleIntensity * 0.4 * Math.sin(time * 12 + i * 1.5);
        const scale = 1 + basePulse + ripplePulse;
        orb.scale.setScalar(scale);
        
        // Brightness pulse during ripple - much brighter
        if (orb.material && rippleIntensity > 0) {
            orb.material.opacity = Math.min(1, 0.6 + rippleIntensity * 0.8);
        } else if (orb.material) {
            orb.material.opacity = 0.6;
        }
    });
    
    renderer.render(scene, camera);
}

// Trigger ripple effect - called from app.js
function triggerOrbRipple(intensity = 1) {
    rippleEffect.active = true;
    rippleEffect.startTime = Date.now();
    rippleEffect.intensity = intensity * 2; // Double the intensity
}

// Expose to global scope for app.js
window.triggerOrbRipple = triggerOrbRipple;

function onResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -10 * aspect;
    camera.right = 10 * aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
    targetMouseX = event.clientX - window.innerWidth / 2;
    targetMouseY = event.clientY - window.innerHeight / 2;
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
