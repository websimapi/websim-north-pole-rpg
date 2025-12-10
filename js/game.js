import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import nipplejs from 'nipplejs';
import { Player, NPC, StaticObject } from './entities.js';

export class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.clock = new THREE.Clock();
        this.entities = {}; // id -> Entity
        this.localPlayer = null;
        this.interactables = [];
        this.input = { x: 0, y: 0 };
        this.keys = {};
        this.audioListener = new THREE.AudioListener();
    }

    async init() {
        // Scene Setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.008); // Distance fog

        // Camera (Isometric-ish)
        const aspect = window.innerWidth / window.innerHeight;
        const d = 25;
        this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
        this.camera.position.set(20, 20, 20); // ISO Angle
        this.camera.lookAt(this.scene.position);
        this.camera.add(this.audioListener);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Post Processing (AAA Feel)
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // Bloom (Glowy Christmas lights)
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        bloomPass.threshold = 0.8;
        bloomPass.strength = 0.4; // Subtle glow
        bloomPass.radius = 0.5;
        this.composer.addPass(bloomPass);

        const outputPass = new OutputPass();
        this.composer.addPass(outputPass);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xfffaed, 1.2); // Warm sun
        dirLight.position.set(50, 80, 50);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 200;
        dirLight.shadow.bias = -0.001;
        
        // Shadow camera bounds for Orthographic
        const dLight = 50;
        dirLight.shadow.camera.left = -dLight;
        dirLight.shadow.camera.right = dLight;
        dirLight.shadow.camera.top = dLight;
        dirLight.shadow.camera.bottom = -dLight;
        this.scene.add(dirLight);

        // Environment
        this.buildWorld();

        // Inputs
        this.setupInputs();

        // Handle Resize
        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Initialize Local Player
        this.localPlayer = new Player('local', 'paper_elf.png', true);
        this.scene.add(this.localPlayer.mesh);
        this.entities['local'] = this.localPlayer;
    }

    buildWorld() {
        const loader = new THREE.TextureLoader();       

        // Ground
        const groundTexture = loader.load('snow_ground.png');
        groundTexture.wrapS = THREE.RepeatWrapping;
        groundTexture.wrapT = THREE.RepeatWrapping;
        groundTexture.repeat.set(16, 16);
        
        const groundGeo = new THREE.PlaneGeometry(256, 256);
        const groundMat = new THREE.MeshStandardMaterial({ 
            map: groundTexture,
            roughness: 0.8,
            metalness: 0.1
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Santa's Workshop
        const workshop = new StaticObject('workshop', 'paper_workshop.png', 12, 10);
        workshop.mesh.position.set(0, 5, -20);
        this.scene.add(workshop.mesh);
        this.interactables.push({
            obj: workshop,
            id: 'workshop',
            range: 10,
            action: () => window.App.ui.showDialog("Santa", "Ho ho ho! Welcome to the North Pole. Help us gather candy!")
        });       

        // Santa NPC
        const santa = new NPC('santa_npc', 'paper_santa.png');
        santa.mesh.position.set(0, 1.5, -12);
        this.scene.add(santa.mesh);

        // Random Trees
        for(let i=0; i<30; i++) {
            const x = (Math.random() - 0.5) * 200;
            const z = (Math.random() - 0.5) * 200;
            // Avoid center
            if (Math.abs(x) < 20 && Math.abs(z) < 30) continue;

            const tree = new StaticObject(`tree_${i}`, 'paper_tree.png', 4, 6);
            tree.mesh.position.set(x, 3, z);
            this.scene.add(tree.mesh);
        }
    }

    setupInputs() {
        // Keyboard
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if(e.code === 'KeyE') this.checkInteraction();
        });
        document.addEventListener('keyup', (e) => this.keys[e.code] = false);

        // Mobile Joystick
        const manager = nipplejs.create({
            zone: document.getElementById('joystick-zone'),
            mode: 'static', 
            position: { left: '50%', top: '50%' }, 
            color: 'red'
        });

        manager.on('move', (evt, data) => {
            if (data.vector) {
                this.input.x = data.vector.x;
                this.input.y = -data.vector.y; // Nipple Y is inverted relative to 3D Z
            }
        });

        manager.on('end', () => {
            this.input.x = 0;
            this.input.y = 0;
        });
    }

    checkInteraction() {
        const pPos = this.localPlayer.mesh.position;
        let closest = null;
        let minDist = Infinity;

        // Check static interactables
        for (const item of this.interactables) {
            const dist = pPos.distanceTo(item.obj.mesh.position);
            if (dist < item.range && dist < minDist) {
                closest = item;
                minDist = dist;
            }
        }

        // Check collectible objects from Network state
        if (window.App.network && window.App.network.roomState.objects) {
            for(const [id, data] of Object.entries(window.App.network.roomState.objects)) {
                if(!data) continue;
                const objPos = new THREE.Vector3(data.x, 0, data.y);
                const dist = pPos.distanceTo(objPos);
                if(dist < 3) {
                     window.App.network.collectItem(id, data.type);
                     return; // Priority to collection
                }
            }
        }

        if (closest) {
            closest.action();
        }
    }

    update() {
        const dt = this.clock.getDelta();

        // Input Processing
        let moveX = 0;
        let moveZ = 0;

        if (this.keys['KeyW'] || this.keys['ArrowUp']) moveZ = -1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) moveZ = 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveX = -1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) moveX = 1;

        if (this.input.x !== 0 || this.input.y !== 0) {
            moveX = this.input.x;
            moveZ = this.input.y;
        }

        // Normalize vector
        if (moveX !== 0 || moveZ !== 0) {
            const len = Math.sqrt(moveX*moveX + moveZ*moveZ);
            moveX /= len;
            moveZ /= len;
        }

        // Update Local Player
        if (this.localPlayer) {
            this.localPlayer.move(moveX, moveZ, dt);
            
            // Camera Follow
            const targetPos = this.localPlayer.mesh.position.clone();
            targetPos.add(new THREE.Vector3(20, 20, 20)); // Offset
            this.camera.position.lerp(targetPos, 0.1);
            this.camera.lookAt(this.localPlayer.mesh.position);
        }

        // Update other entities (billboarding)
        for(const id in this.entities) {
            this.entities[id].update(dt, this.camera);
        }
        for(const item of this.interactables) {
            item.obj.update(dt, this.camera);
        }

        // UI Updates based on proximity
        this.updateInteractionUI();

        this.composer.render();
    }

    updateInteractionUI() {
        if (!this.localPlayer) return;
        const pPos = this.localPlayer.mesh.position;
        let show = false;
        let text = "";

        // Check static interactables
        for (const item of this.interactables) {
            if (pPos.distanceTo(item.obj.mesh.position) < item.range) {
                show = true;
                text = "Talk";
                break;
            }
        }
        
        // Check dynamic items
         if (!show && window.App.network && window.App.network.roomState.objects) {
            for(const [id, data] of Object.entries(window.App.network.roomState.objects)) {
                if(!data) continue;
                const objPos = new THREE.Vector3(data.x, 0, data.y);
                if(pPos.distanceTo(objPos) < 3) {
                     show = true;
                     text = "Collect " + data.type;
                     break;
                }
            }
        }

        window.App.ui.toggleInteraction(show, text);
    }

    onWindowResize() {
        const aspect = window.innerWidth / window.innerHeight;
        const d = 25;
        this.camera.left = -d * aspect;
        this.camera.right = d * aspect;
        this.camera.top = d;
        this.camera.bottom = -d;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }
}