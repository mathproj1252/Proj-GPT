class ChatBot {
    constructor() {
        this.pipeline = null;
        this.isGenerating = false;
        this.isModelLoading = false;
        this.chatHistory = [];
        this.maxTokens = 50;
        
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.chatMessages = document.getElementById('chat-messages');
        this.userInput = document.getElementById('user-input');
        this.sendBtn = document.getElementById('send-btn');
        this.loadModelBtn = document.getElementById('load-model-btn');
        this.status = document.getElementById('status');
        this.maxTokensSlider = document.getElementById('max-tokens');
        this.tokensValue = document.getElementById('tokens-value');
        
        // Начальное состояние
        this.sendBtn.disabled = true;
        this.userInput.placeholder = "Сначала загрузите модель...";
    }

    setupEventListeners() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.loadModelBtn.addEventListener('click', () => this.loadModel());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isGenerating && this.pipeline) {
                this.sendMessage();
            }
        });
        
        this.maxTokensSlider.addEventListener('input', (e) => {
            this.maxTokens = parseInt(e.target.value);
            this.tokensValue.textContent = this.maxTokens;
        });
    }

    async loadModel() {
        if (this.isModelLoading) return;
        
        this.isModelLoading = true;
        this.loadModelBtn.disabled = true;
        this.loadModelBtn.textContent = '⏳ Загрузка модели...';
        this.updateStatus('🔄 Начинаем загрузку GPT-2 Tiny...');

        try {
            // Используем более легкую модель для демонстрации
            this.updateStatus('📥 Скачиваем модель (~150MB)... Это займет несколько минут');
            
            // Создаем пайплайн для текстовой генерации
            this.pipeline = await transformers.pipeline(
                'text-generation',
                'Xenova/distilgpt2', // Более легкая версия GPT-2
                {
                    device: 'cpu',
                    quantized: true,
                    progress_callback: (data) => {
                        if (data.status === 'downloading') {
                            const percent = data.progress * 100;
                            this.updateStatus(`📥 Загрузка модели: ${percent.toFixed(1)}%`);
                        }
                    }
                }
            );

            this.updateStatus('✅ Модель загружена! Можно общаться!');
            this.addBotMessage('Отлично! Модель GPT-2 успешно загружена в ваш браузер! 🎉 Теперь я готов отвечать на ваши сообщения. Попробуйте написать что-нибудь!');
            
            // Активируем интерфейс
            this.sendBtn.disabled = false;
            this.userInput.placeholder = 'Введите ваше сообщение...';
            this.userInput.focus();
            this.loadModelBtn.style.display = 'none';

        } catch (error) {
            console.error('Ошибка загрузки модели:', error);
            this.updateStatus('❌ Ошибка загрузки. Проверьте консоль и попробуйте снова.');
            this.addBotMessage('К сожалению, не удалось загрузить модель. Пожалуйста, проверьте подключение к интернету и обновите страницу.');
            
            this.loadModelBtn.disabled = false;
            this.loadModelBtn.textContent = '🔄 Попробовать снова';
            this.isModelLoading = false;
        }
    }

    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message || this.isGenerating || !this.pipeline) return;

        // Очищаем input и добавляем сообщение пользователя
        this.userInput.value = '';
        this.addUserMessage(message);
        
        this.isGenerating = true;
        this.sendBtn.disabled = true;
        this.sendBtn.textContent = 'Генерация...';

        try {
            const response = await this.generateResponse(message);
            this.addBotMessage(response);
            this.chatHistory.push({ role: 'user', content: message });
            this.chatHistory.push({ role: 'bot', content: response });

        } catch (error) {
            console.error('Ошибка генерации:', error);
            this.addBotMessage('Извините, произошла ошибка при генерации ответа. Попробуйте еще раз.');
        } finally {
            this.isGenerating = false;
            this.sendBtn.disabled = false;
            this.sendBtn.textContent = 'Отправить';
            this.userInput.focus();
        }
    }

    async generateResponse(message) {
        // Создаем промпт на основе истории
        let prompt = this.chatHistory
            .slice(-4) // Берем последние 4 сообщения
            .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
            .join('\n');
        
        prompt += `\nUser: ${message}\nAssistant:`;
        
        try {
            const output = await this.pipeline(prompt, {
                max_new_tokens: this.maxTokens,
                temperature: 0.7,
                do_sample: true,
                repetition_penalty: 1.1,
                pad_token_id: 50256,
            });

            let response = output[0].generated_text;
            
            // Извлекаем только ответ ассистента
            const assistantResponse = response.split('Assistant:').pop().trim();
            
            // Очищаем ответ от повторений
            return this.cleanResponse(assistantResponse);
            
        } catch (error) {
            throw new Error(`Generation failed: ${error.message}`);
        }
    }

    cleanResponse(text) {
        // Удаляем лишние пробелы и переносы
        return text
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split('.')[0] + '.'; // Берем только первое предложение для краткости
    }

    addUserMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message user-message';
        messageElement.innerHTML = `
            <div class="message-content">${this.escapeHtml(message)}</div>
        `;
        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    addBotMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message bot-message';
        messageElement.innerHTML = `
            <div class="message-content">${this.escapeHtml(message)}</div>
        `;
        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    updateStatus(text) {
        this.status.textContent = text;
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Инициализация когда страница загрузится
document.addEventListener('DOMContentLoaded', () => {
    new ChatBot();
});
