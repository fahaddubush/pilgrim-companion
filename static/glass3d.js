/**
 * Three.js Liquid Glass System
 * Full 3D glass effect with real-time refraction, chromatic aberration, and dynamic distortion
 * Renders glass panels that overlay DOM elements with WebGL effects
 */

class ThreeGlassSystem {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.glassPanels = new Map();
        this.mouse = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
        this.targetMouse = { x: 0.5, y: 0.5 };
        this.time = 0;
        this.rafId = null;
        
        this.init();
    }
    
    init() {
        // Scene
        this.scene = new THREE.Scene();
        
        // Camera - use pixel coordinates for easier DOM mapping
        this.camera = new THREE.OrthographicCamera(
            0, window.innerWidth,
            0, window.innerHeight,
            -1000, 1000
        );
        this.camera.position.z = 100;
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);
        
        // Canvas styling - sits on top of DOM elements
        const canvas = this.renderer.domElement;
        canvas.className = 'lg-canvas-overlay';
        canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 5;
        `;
        document.body.appendChild(canvas);
        
        // Events
        window.addEventListener('resize', () => this.onResize(), { passive: true });
        window.addEventListener('mousemove', (e) => this.onMouseMove(e), { passive: true });
        window.addEventListener('scroll', () => {
            this.mouse.vy += 0.02;
            // Update panel positions on scroll
            this.updateAllPanels();
        }, { passive: true });
        
        // Start animation loop
        this.animate();
    }
    
    // Glass shader material with all the liquid effects
    createGlassMaterial() {
        return new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            depthTest: false,
            uniforms: {
                uTime: { value: 0 },
                uMouse: { value: new THREE.Vector4(0.5, 0.5, 0, 0) },
                uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                uRefraction: { value: 0.12 },
                uDistortion: { value: 0.018 },
                uEdgeGlow: { value: 0.35 },
                uTint: { value: new THREE.Vector3(0.82, 0.95, 1.0) },
                uThickness: { value: 1.0 },
                uBorderRadius: { value: 0.08 },
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec2 vScreenUv;
                
                void main() {
                    vUv = uv;
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vScreenUv = worldPos.xy / uResolution;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                
                uniform float uTime;
                uniform vec4 uMouse;
                uniform vec2 uResolution;
                uniform float uRefraction;
                uniform float uDistortion;
                uniform float uEdgeGlow;
                uniform vec3 uTint;
                uniform float uThickness;
                uniform float uBorderRadius;
                
                varying vec2 vUv;
                varying vec2 vScreenUv;
                
                // Smooth noise
                float hash(vec2 p) {
                    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
                    p3 += dot(p3, p3.yzx + 33.33);
                    return fract((p3.x + p3.y) * p3.z);
                }
                
                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    
                    float a = hash(i);
                    float b = hash(i + vec2(1.0, 0.0));
                    float c = hash(i + vec2(0.0, 1.0));
                    float d = hash(i + vec2(1.0, 1.0));
                    
                    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
                }
                
                float fbm(vec2 p) {
                    float value = 0.0;
                    float amplitude = 0.5;
                    float frequency = 1.0;
                    for (int i = 0; i < 4; i++) {
                        value += amplitude * noise(p * frequency);
                        amplitude *= 0.5;
                        frequency *= 2.0;
                    }
                    return value;
                }
                
                // Rounded rectangle SDF for smooth corners
                float roundedBox(vec2 p, vec2 size, float radius) {
                    vec2 q = abs(p) - size + radius;
                    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
                }
                
                // Environment/background simulation
                vec3 sampleEnvironment(vec2 uv, float time) {
                    float n1 = fbm(uv * 3.0 + time * 0.2);
                    float n2 = fbm(uv * 6.0 - time * 0.15);
                    float n3 = fbm(uv * 12.0 + time * 0.1);
                    
                    vec3 deep = vec3(0.02, 0.08, 0.18);
                    vec3 mid = vec3(0.05, 0.20, 0.35);
                    vec3 light = vec3(0.15, 0.45, 0.55);
                    vec3 accent = vec3(0.2, 0.7, 0.6);
                    
                    float blend = n1 * 0.5 + n2 * 0.35 + n3 * 0.15;
                    vec3 color = mix(deep, mid, blend);
                    color = mix(color, light, n2 * 0.4);
                    color += accent * n3 * 0.15;
                    
                    return color;
                }
                
                void main() {
                    vec2 uv = vUv;
                    vec2 centered = uv - 0.5;
                    float t = uTime;
                    
                    // Mouse influence
                    float mouseSpeed = length(uMouse.zw);
                    
                    // Rounded box SDF for proper glass shape
                    float radius = uBorderRadius;
                    float sdf = roundedBox(centered, vec2(0.5 - 0.003), radius);
                    
                    // === VERY VISIBLE BORDER - 4% thickness ===
                    float borderThickness = 0.04;
                    float borderMask = smoothstep(0.0, -0.008, sdf) * (1.0 - smoothstep(-borderThickness, -borderThickness - 0.008, sdf));
                    
                    // Animated distortion field
                    float n1 = fbm(uv * 5.0 + t * 0.4);
                    float n2 = fbm(uv * 7.0 - t * 0.3 + 100.0);
                    
                    vec2 distortion = vec2(n1 - 0.5, n2 - 0.5) * uDistortion;
                    distortion *= 1.0 + mouseSpeed * 8.0;
                    
                    // Parallax from mouse position
                    vec2 parallax = (uMouse.xy - 0.5) * uRefraction * 0.5;
                    
                    // Refracted UV for environment sampling
                    vec2 refractedUv = vScreenUv + distortion + parallax;
                    
                    // Chromatic aberration
                    float aberration = 0.004 * (1.0 + mouseSpeed * 3.0);
                    vec3 envR = sampleEnvironment(refractedUv + vec2(aberration, 0.0), t);
                    vec3 envG = sampleEnvironment(refractedUv, t);
                    vec3 envB = sampleEnvironment(refractedUv - vec2(aberration, 0.0), t);
                    vec3 env = vec3(envR.r, envG.g, envB.b);
                    
                    // Apply tint to inner area
                    vec3 innerColor = mix(env, uTint * env, 0.2);
                    innerColor *= 1.0 + (n1 - 0.5) * 0.12;  // Lens effect
                    
                    // === BRIGHT GLASS BORDER ===
                    vec3 borderBaseColor = vec3(0.4, 0.7, 0.9);  // Cyan-blue base
                    
                    // Moving light along border
                    float angle = atan(centered.y, centered.x);
                    float light1 = pow(sin(angle * 2.0 - t * 1.8) * 0.5 + 0.5, 2.0);
                    float light2 = pow(sin(angle * 4.0 + t * 2.5) * 0.5 + 0.5, 3.0);
                    float movingLight = light1 * 0.7 + light2 * 0.5;
                    
                    // Fresnel on border - bright at edges
                    float borderFresnel = pow(1.0 - abs(dot(normalize(vec3(centered * 3.0, 0.5)), vec3(0.0, 0.0, 1.0))), 1.5);
                    
                    // Top-left highlight, bottom-right shadow (3D bevel)
                    float bevelAngle = (centered.x + centered.y) * 1.5;
                    float topLight = smoothstep(-0.3, 0.3, -bevelAngle) * 0.8;
                    float bottomShadow = smoothstep(-0.3, 0.3, bevelAngle) * 0.4;
                    
                    // Specular
                    vec3 lightDir = normalize(vec3(0.4 + uMouse.x * 0.3, 0.5 + uMouse.y * 0.3, 0.8));
                    vec3 borderNormal = normalize(vec3(centered * 2.0, 1.0));
                    float borderSpec = pow(max(dot(reflect(-lightDir, borderNormal), vec3(0.0, 0.0, 1.0)), 0.0), 32.0);
                    
                    // Build border color
                    vec3 borderColor = borderBaseColor * 0.5;  // Base
                    borderColor += vec3(0.6, 0.85, 1.0) * movingLight;  // Moving light
                    borderColor += vec3(0.5, 0.7, 0.9) * borderFresnel * 0.6;  // Fresnel
                    borderColor += vec3(1.0, 0.98, 0.95) * topLight;  // Top-left bright
                    borderColor -= vec3(0.2) * bottomShadow;  // Bottom-right dark
                    borderColor += vec3(1.0) * borderSpec * 0.7;  // Specular
                    
                    // Sparkles on border
                    float borderSparkle = smoothstep(0.92, 1.0, noise(uv * 80.0 + t * 3.0)) * 0.8;
                    borderColor += vec3(1.0) * borderSparkle;
                    
                    // === INNER AREA EFFECTS ===
                    vec3 normal = normalize(vec3(distortion * 40.0, 1.0));
                    float innerFresnel = pow(1.0 - max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0), 2.5);
                    float innerSpec = pow(max(dot(reflect(-lightDir, normal), vec3(0.0, 0.0, 1.0)), 0.0), 48.0);
                    float sparkle = smoothstep(0.9, 1.0, noise(uv * 50.0 + t * 2.0)) * 0.08;
                    
                    innerColor += vec3(0.5, 0.7, 0.9) * innerFresnel * 0.15;
                    innerColor += vec3(1.0) * innerSpec * 0.3;
                    innerColor += vec3(1.0) * sparkle;
                    
                    // === COMPOSITING ===
                    vec3 finalColor = mix(innerColor, borderColor, borderMask);
                    
                    // Alpha
                    float innerAlpha = 0.22 + uThickness * 0.18;
                    float borderAlpha = 0.9;  // Border is very visible
                    float alpha = mix(innerAlpha, borderAlpha, borderMask);
                    
                    // Clip to shape
                    float clip = 1.0 - smoothstep(-0.002, 0.002, sdf);
                    alpha *= clip;
                    
                    // Outer glow
                    float outerGlow = smoothstep(0.015, 0.0, sdf) * (1.0 - smoothstep(0.0, -0.005, sdf));
                    finalColor += vec3(0.5, 0.75, 1.0) * outerGlow * 0.5;
                    alpha = max(alpha, outerGlow * 0.5);
                    
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
        });
    }
    
    // Register a DOM element as a glass surface
    registerSurface(el, props = {}) {
        const material = this.createGlassMaterial();
        
        // Apply custom properties
        if (props.refraction !== undefined) material.uniforms.uRefraction.value = props.refraction;
        if (props.distortion !== undefined) material.uniforms.uDistortion.value = props.distortion;
        if (props.edge !== undefined) material.uniforms.uEdgeGlow.value = props.edge;
        if (props.thickness !== undefined) material.uniforms.uThickness.value = props.thickness;
        if (props.tint) material.uniforms.uTint.value.set(...props.tint);
        
        // Create plane geometry
        const geometry = new THREE.PlaneGeometry(1, 1);
        const mesh = new THREE.Mesh(geometry, material);
        
        this.scene.add(mesh);
        this.glassPanels.set(el, { mesh, material, geometry });
        
        // Initial position update
        this.updatePanelPosition(el);
        
        // Watch for size changes
        if (window.ResizeObserver) {
            const observer = new ResizeObserver(() => this.updatePanelPosition(el));
            observer.observe(el);
        }
        
        return () => {
            this.scene.remove(mesh);
            geometry.dispose();
            material.dispose();
            this.glassPanels.delete(el);
        };
    }
    
    updatePanelPosition(el) {
        const panel = this.glassPanels.get(el);
        if (!panel) return;
        
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const borderRadius = parseFloat(style.borderRadius) || 0;
        
        // Position and scale in screen pixels
        panel.mesh.scale.set(rect.width, rect.height, 1);
        panel.mesh.position.set(
            rect.left + rect.width / 2,
            window.innerHeight - (rect.top + rect.height / 2),
            0
        );
        
        // Update border radius uniform (normalized)
        const normalizedRadius = borderRadius / Math.min(rect.width, rect.height);
        panel.material.uniforms.uBorderRadius.value = Math.min(normalizedRadius, 0.5);
        panel.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    }
    
    updateAllPanels() {
        this.glassPanels.forEach((panel, el) => {
            this.updatePanelPosition(el);
        });
    }
    
    onMouseMove(e) {
        this.targetMouse.x = e.clientX / window.innerWidth;
        this.targetMouse.y = 1 - e.clientY / window.innerHeight;
    }
    
    onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        this.camera.right = w;
        this.camera.bottom = h;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(w, h);
        this.updateAllPanels();
    }
    
    animate() {
        this.rafId = requestAnimationFrame(() => this.animate());
        
        this.time += 0.016; // ~60fps time step
        
        // Smooth mouse tracking
        const prevX = this.mouse.x;
        const prevY = this.mouse.y;
        this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.06;
        this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.06;
        this.mouse.vx = this.mouse.x - prevX;
        this.mouse.vy = this.mouse.y - prevY;
        
        // Update all panels
        this.glassPanels.forEach((panel) => {
            panel.material.uniforms.uTime.value = this.time;
            panel.material.uniforms.uMouse.value.set(
                this.mouse.x,
                this.mouse.y,
                this.mouse.vx,
                this.mouse.vy
            );
        });
        
        this.renderer.render(this.scene, this.camera);
    }
    
    destroy() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.glassPanels.forEach((panel) => {
            this.scene.remove(panel.mesh);
            panel.geometry.dispose();
            panel.material.dispose();
        });
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }
}

// Singleton instance
let glassSystem = null;

export function initLiquidGlass(options = {}) {
    if (!glassSystem) {
        glassSystem = new ThreeGlassSystem();
    }
    
    // Auto-register all elements with data-glass-surface attribute
    document.querySelectorAll('[data-glass-surface]').forEach(el => {
        const refraction = parseFloat(el.dataset.refraction) || 0.12;
        const distortion = parseFloat(el.dataset.distortion) || 0.018;
        const edge = parseFloat(el.dataset.edge) || 0.35;
        const thickness = parseFloat(el.dataset.thickness) || 1.0;
        
        glassSystem.registerSurface(el, {
            refraction,
            distortion,
            edge,
            thickness,
        });
    });
    
    return glassSystem;
}

// Register a new element as a glass surface (for dynamically added elements)
export function registerGlassSurface(el, props = {}) {
    if (!glassSystem) return null;
    return glassSystem.registerSurface(el, {
        refraction: props.refraction || 0.1,
        distortion: props.distortion || 0.015,
        edge: props.edge || 0.3,
        thickness: props.thickness || 0.8,
        ...props
    });
}

export { ThreeGlassSystem };
