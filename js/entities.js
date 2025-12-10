import * as THREE from 'three';

// Base class for paper cutout sprites
class PaperEntity {
    constructor(id, texturePath, width = 1, height = 1) {
        this.id = id;
        this.mesh = this.createMesh(texturePath, width, height);
    }

    createMesh(texturePath, w, h) {
        const map = new THREE.TextureLoader().load(texturePath);
        // Ensure transparency works
        const mat = new THREE.MeshBasicMaterial({ 
            map: map, 
            transparent: true, 
            side: THREE.DoubleSide,
            alphaTest: 0.5 // Crisp cutout edges
        });
        const geo = new THREE.PlaneGeometry(w, h);
        const mesh = new THREE.Mesh(geo, mat);
        
        // Shadows for sprites need custom logic or just cast shadow
        mesh.castShadow = true;
        mesh.receiveShadow = false; // Planes don't receive self-shadows well in this setup
        return mesh;
    }

    update(dt, camera) {
        // Billboard effect: only rotate Y to face camera plane
        // We calculate the angle to face the camera
        if (camera) {
            this.mesh.lookAt(camera.position);
            // Lock X and Z rotation if we want strictly upright sprites (optional)
            // But for isometric, looking at camera usually looks best for "paper" feel
            // If we want "standing" paper:
            // this.mesh.rotation.x = 0;
            // this.mesh.rotation.z = 0;
        }
    }
}

export class Player extends PaperEntity {
    constructor(id, texturePath, isLocal = false) {
        super(id, texturePath, 2, 2);
        this.isLocal = isLocal;
        this.speed = 15;
        this.mesh.position.y = 1; // Half height
    }

    move(dx, dz, dt) {
        if (dx === 0 && dz === 0) return;

        const newX = this.mesh.position.x + dx * this.speed * dt;
        const newZ = this.mesh.position.z + dz * this.speed * dt;

        // Bounds check (World is -128 to 128)
        const limit = 120;
        this.mesh.position.x = Math.max(-limit, Math.min(limit, newX));
        this.mesh.position.z = Math.max(-limit, Math.min(limit, newZ));
    }
}

export class NPC extends PaperEntity {
    constructor(id, texturePath) {
        super(id, texturePath, 2.5, 2.5);
    }
}

export class StaticObject extends PaperEntity {
    constructor(id, texturePath, w, h) {
        super(id, texturePath, w, h);
        this.mesh.position.y = h / 2;
    }
    
    // Static objects might not need to billboard every frame if they are "3D-ish"
    // But since we want paper style, we might billboard them too or keep them fixed.
    update(dt, camera) {
        // Buildings usually don't billboard, trees might?
        // Let's billboard trees but not buildings if they are "facades"
        if (this.id.includes('tree')) {
             // Cylindrical billboarding for trees
             this.mesh.lookAt(camera.position.x, this.mesh.position.y, camera.position.z);
        }
    }
}