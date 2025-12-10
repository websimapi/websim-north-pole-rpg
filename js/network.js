import * as THREE from 'three';
import { Player, PaperEntity } from './entities.js';

export class Network {
    constructor() {
        this.room = new WebsimSocket();
        this.peers = {}; // remote clientId -> Player Entity
        this.roomState = {};
        this.items = {}; // id -> ThreeJS Mesh
    }

    async init() {
        await this.room.initialize();

        // Subscribe to presence (Players)
        this.room.subscribePresence((presence) => {
            this.handlePresence(presence);
        });

        // Subscribe to room state (World items)
        this.room.subscribeRoomState((state) => {
            this.roomState = state;
            this.handleRoomState(state);
        });
        
        // Initial spawn of items if empty (Master client logic roughly)
        // Since we can't easily detect "Master", we'll just check if empty and roll chance
        // Real logic should be more robust, but this works for demo
        if (!this.room.roomState.objects) {
            this.spawnInitialLoot();
        }

        this.startBroadcastLoop();
    }

    spawnInitialLoot() {
        const loot = {};
        const types = ['candy', 'gumdrop', 'sugar'];
        for(let i=0; i<20; i++) {
            const id = `item_${Date.now()}_${i}`;
            loot[id] = {
                x: (Math.random() - 0.5) * 200,
                y: (Math.random() - 0.5) * 200,
                type: types[Math.floor(Math.random() * types.length)]
            };
        }
        this.room.updateRoomState({ objects: loot });
    }

    update() {
        // Interpolate remote players if needed
    }

    collectItem(id, type) {
        // Optimistic UI update
        window.App.ui.addCurrency(type, 1);
        
        // Play sound
        const sfx = new Audio('sfx_collect.mp3');
        sfx.volume = 0.5;
        sfx.play();

        // Network update
        this.room.updateRoomState({
            objects: {
                [id]: null // Delete
            }
        });

        // Chance to respawn immediately somewhere else
        setTimeout(() => {
             const newId = `item_${Date.now()}_respawn`;
             const types = ['candy', 'gumdrop', 'sugar'];
             this.room.updateRoomState({
                objects: {
                    [newId]: {
                        x: (Math.random() - 0.5) * 200,
                        y: (Math.random() - 0.5) * 200,
                        type: types[Math.floor(Math.random() * types.length)]
                    }
                }
             })
        }, 5000);
    }

    startBroadcastLoop() {
        setInterval(() => {
            const p = window.App.game.localPlayer;
            if (p) {
                this.room.updatePresence({
                    x: p.mesh.position.x,
                    z: p.mesh.position.z,
                    skin: 'paper_elf.png' // Could be dynamic
                });
            }
        }, 50); // 20 ticks per sec
    }

    handlePresence(presence) {
        // Add new players
        for (const id in presence) {
            if (id === this.room.clientId) continue; // Skip self

            const data = presence[id];
            if (!this.peers[id]) {
                // New player
                const newPeer = new Player(id, data.skin || 'paper_elf.png');
                window.App.game.scene.add(newPeer.mesh);
                window.App.game.entities[id] = newPeer;
                this.peers[id] = newPeer;
            } else {
                // Update position
                const peer = this.peers[id];
                // Direct update (add lerping for smoothness in production)
                if (data.x !== undefined && data.z !== undefined) {
                    peer.mesh.position.x = data.x;
                    peer.mesh.position.z = data.z;
                }
            }
        }

        // Remove disconnected
        for (const id in this.peers) {
            if (!presence[id]) {
                window.App.game.scene.remove(this.peers[id].mesh);
                delete window.App.game.entities[id];
                delete this.peers[id];
            }
        }
    }

    handleRoomState(state) {
        if (!state.objects) return;

        // Sync Objects
        const currentIds = new Set(Object.keys(this.items));
        
        for (const [id, data] of Object.entries(state.objects)) {
            if (data === null) {
                // Was deleted
                if (this.items[id]) {
                    window.App.game.scene.remove(this.items[id]);
                    delete this.items[id];
                }
                continue;
            }

            if (!this.items[id]) {
                // Create Item
                const texture = 'paper_present.png'; // All loot is presents for now
                const mat = new THREE.MeshBasicMaterial({ 
                    map: new THREE.TextureLoader().load(texture),
                    transparent: true,
                    side: THREE.DoubleSide
                });
                const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
                mesh.position.set(data.x, 0.5, data.y);
                
                // Add floating animation data
                mesh.userData = { initialY: 0.5, timeOffset: Math.random() * 100 };
                
                // Hook into update loop for float
                mesh.onBeforeRender = () => {
                    const t = performance.now() / 1000;
                    mesh.position.y = 0.5 + Math.sin(t * 2 + mesh.userData.timeOffset) * 0.2;
                    mesh.lookAt(window.App.game.camera.position);
                };

                window.App.game.scene.add(mesh);
                this.items[id] = mesh;
            }
        }
    }
}