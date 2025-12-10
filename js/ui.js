export class UI {
    constructor(userData) {
        this.data = userData;
        this.elements = {
            candy: document.getElementById('candy-count'),
            gumdrop: document.getElementById('gumdrop-count'),
            sugar: document.getElementById('sugar-count'),
            prompt: document.getElementById('interaction-prompt'),
            promptText: document.getElementById('interaction-text'),
            chat: document.getElementById('chat-feed')
        };
        this.refresh();
    }

    refresh() {
        this.elements.candy.innerText = this.data.currencies.candy;
        this.elements.gumdrop.innerText = this.data.currencies.gumdrop;
        this.elements.sugar.innerText = this.data.currencies.sugar;
        this.save();
    }

    addCurrency(type, amount) {
        if (!this.data.currencies[type]) this.data.currencies[type] = 0;
        this.data.currencies[type] += amount;
        this.log(`Received ${amount} ${type}!`);
        this.refresh();
    }

    toggleInteraction(show, text) {
        if (show) {
            this.elements.prompt.classList.remove('hidden');
            this.elements.promptText.innerText = text;
        } else {
            this.elements.prompt.classList.add('hidden');
        }
    }

    showDialog(speaker, text) {
        // Simple alert replacement for now, could be a nice modal
        this.log(`[${speaker}]: ${text}`);
        alert(`${speaker}: ${text}`);
    }

    log(msg) {
        const div = document.createElement('div');
        div.className = 'chat-msg';
        div.innerText = msg;
        this.elements.chat.prepend(div);
        
        // Cleanup old messages
        if (this.elements.chat.children.length > 5) {
            this.elements.chat.lastChild.remove();
        }
    }

    save() {
        localStorage.setItem('christmas_rpg_data', JSON.stringify(this.data));
    }
}