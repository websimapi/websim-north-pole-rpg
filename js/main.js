import { Game } from './game.js';
import { Network } from './network.js';
import { UI } from './ui.js';

// Global state container
window.App = {
    game: null,
    network: null,
    ui: null,
    config: {
        moveSpeed: 10,
        mapBounds: 128 // -128 to 128
    }
};

async function init() {
    console.log("Initializing Christmas RPG...");
    
    // Load User Data
    const savedData = localStorage.getItem('christmas_rpg_data');
    const userData = savedData ? JSON.parse(savedData) : {
        currencies: { candy: 0, gumdrop: 0, sugar: 0 },
        quests: { finishedStart: false }
    };

    window.App.ui = new UI(userData);
    window.App.game = new Game();
    window.App.network = new Network();

    await window.App.game.init();
    await window.App.network.init();

    // Start background music on first interaction
    const startAudio = () => {
        window.App.game.audioListener.context.resume();
        const bgm = new Audio('music_bg.mp3');
        bgm.loop = true;
        bgm.volume = 0.3;
        bgm.play().catch(e => console.log("Audio waiting for interaction"));
        document.removeEventListener('click', startAudio);
        document.removeEventListener('keydown', startAudio);
        document.removeEventListener('touchstart', startAudio);
    };

    document.addEventListener('click', startAudio);
    document.addEventListener('keydown', startAudio);
    document.addEventListener('touchstart', startAudio);

    // Render Loop
    function animate() {
        requestAnimationFrame(animate);
        window.App.game.update();
        window.App.network.update();
    }
    animate();
}

init();