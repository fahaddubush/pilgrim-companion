import { initLiquidGlass, registerGlassSurface } from "./glass3d.js";

const chatWindow = document.getElementById("chat-window");
const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const sourcesGrid = document.getElementById("sources-grid");
const modelPill = document.getElementById("model-pill");

let history = [];
let modelConfig = {
    provider: 'ollama',
    ollama_model: 'llama3.2:3b',
    ollama_base_url: 'http://localhost:11434',
    api_model: '',
    api_base_url: '',
    api_key: '',
};

// Format time helper
const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
};

const escapeHtml = (text) => text.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[char]));

// Small, safe Markdown subset. Input is escaped before formatting is applied.
const parseMarkdown = (text) => {
    return escapeHtml(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
};

const glass = initLiquidGlass({ performance: "auto" });

// Register initial bubble
document.querySelectorAll('.bubble').forEach(el => {
    registerGlassSurface(el, { refraction: 0.1, distortion: 0.012, thickness: 0.7 });
});

// Typewriter effect for welcome message
const typewriterEffect = () => {
    const welcomeP = document.querySelector('.welcome-message p');
    if (!welcomeP) return;
    
    const text = "Salam! I can help with Ihram steps, Tawaf, Sa'i, stoning timings, safety tips, and more. How can I support your journey?";
    welcomeP.textContent = '';
    let i = 0;
    
    const typeChar = () => {
        if (i < text.length) {
            welcomeP.textContent += text.charAt(i);
            i++;
            setTimeout(typeChar, 25);
        }
    };
    
    setTimeout(typeChar, 500);
};

// Run typewriter on load
typewriterEffect();

const addMessage = (role, text, meta = {}) => {
    const wrapper = document.createElement("div");
    wrapper.className = `message ${role} bubble`;
    wrapper.dataset.text = text;

    const header = document.createElement("div");
    header.className = "message-header";
    
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = role === "user" ? 'You' : 'Assistant';
    header.appendChild(label);
    
    const timestamp = document.createElement("span");
    timestamp.className = "timestamp";
    timestamp.textContent = formatTime(new Date());
    header.appendChild(timestamp);
    
    wrapper.appendChild(header);

    const body = document.createElement("p");
    body.innerHTML = parseMarkdown(text);
    wrapper.appendChild(body);

    if (role === "bot") {
        const actions = document.createElement("div");
        actions.className = "message-actions";
        
        const copyBtn = document.createElement("button");
        copyBtn.className = "action-btn copy-btn";
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
        copyBtn.onclick = () => copyMessage(text, copyBtn);
        actions.appendChild(copyBtn);
        
        if (meta.responseTime) {
            const timeSpan = document.createElement("span");
            timeSpan.className = "response-time";
            timeSpan.textContent = `Response time: ${meta.responseTime}s`;
            actions.appendChild(timeSpan);
        }
        
        wrapper.appendChild(actions);
    }

    if (role === "bot" && meta.contexts) {
        const sub = document.createElement("div");
        sub.className = "muted";
        sub.textContent = 'Grounded response';
        wrapper.appendChild(sub);
    }

    chatWindow.appendChild(wrapper);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    
    registerGlassSurface(wrapper, { refraction: 0.1, distortion: 0.012, thickness: 0.7 });
    
    // Trigger pulse glow and orb ripple for bot messages
    if (role === "bot") {
        wrapper.classList.add('new-message');
        
        // Trigger background orb ripple effect
        if (window.triggerOrbRipple) {
            window.triggerOrbRipple(0.8);
        }
        
        // Remove glow class after animation
        setTimeout(() => {
            wrapper.classList.remove('new-message');
        }, 1200);
    }
};

// Copy message to clipboard
const copyMessage = async (text, btn) => {
    try {
        await navigator.clipboard.writeText(text);
        const originalText = btn.innerHTML;
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Copied!`;
        btn.classList.add('copied');
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('copied');
        }, 2000);
    } catch (err) {
        console.error('Copy failed:', err);
    }
};

// Add error message with retry button
const addErrorMessage = (errorText, retryFn) => {
    const wrapper = document.createElement("div");
    wrapper.className = "message bot bubble error-message";
    
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = 'Assistant';
    wrapper.appendChild(label);
    
    const body = document.createElement("p");
    body.textContent = errorText;
    wrapper.appendChild(body);
    
    const retryBtn = document.createElement("button");
    retryBtn.className = "retry-btn";
    retryBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg> Retry`;
    retryBtn.onclick = () => {
        wrapper.remove();
        retryFn();
    };
    wrapper.appendChild(retryBtn);
    
    chatWindow.appendChild(wrapper);
    chatWindow.scrollTop = chatWindow.scrollHeight;
};

const addTyping = () => {
    const wrapper = document.createElement("div");
    wrapper.className = "message bot bubble";
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = 'Assistant';
    const typing = document.createElement("div");
    typing.className = "typing";
    typing.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    wrapper.appendChild(label);
    wrapper.appendChild(typing);
    chatWindow.appendChild(wrapper);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    
    registerGlassSurface(wrapper, { refraction: 0.08, distortion: 0.01, thickness: 0.6 });
    
    return wrapper;
};

const sourceCount = document.getElementById("source-count");
const sourcesPanel = document.getElementById("sources-panel");
const sourcesToggle = document.getElementById("sources-toggle");

sourcesToggle?.addEventListener("click", () => {
    sourcesPanel.classList.toggle("collapsed");
});

const updateSources = (contexts, confidence, confidenceMessage, cached = false) => {
    sourcesGrid.replaceChildren();
    if (!contexts || contexts.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = 'No sufficiently relevant references were found.';
        sourcesGrid.appendChild(empty);
        if (sourceCount) sourceCount.textContent = '0 sources';
        return;
    }
    
    // Update source count with confidence badge and cached indicator
    if (sourceCount) {
        sourceCount.replaceChildren(document.createTextNode(`${contexts.length} sources `));
        const badge = document.createElement('span');
        badge.className = `confidence-badge ${['high', 'medium', 'low'].includes(confidence) ? confidence : 'medium'}`;
        badge.textContent = confidence || '';
        badge.title = confidenceMessage || '';
        sourceCount.appendChild(badge);
        if (cached) {
            const cachedBadge = document.createElement('span');
            cachedBadge.className = 'cached-badge';
            cachedBadge.textContent = '⚡ cached';
            sourceCount.appendChild(cachedBadge);
        }
    }
    
    contexts.forEach((ctx) => {
        const card = document.createElement("div");
        card.className = "source-card";
        const truncatedSnippet = ctx.snippet.length > 200 ? ctx.snippet.substring(0, 200) + "..." : ctx.snippet;
        const hasWebUrl = typeof ctx.url === 'string' && /^https?:\/\//i.test(ctx.url);
        const tag = document.createElement(hasWebUrl ? 'a' : 'div');
        tag.className = 'tag';
        tag.textContent = `${ctx.source} · Hybrid score: ${Number(ctx.score).toFixed(2)}`;
        if (hasWebUrl) {
            tag.href = ctx.url;
            tag.target = '_blank';
            tag.rel = 'noopener noreferrer';
        }
        const snippet = document.createElement('div');
        snippet.className = 'snippet';
        snippet.textContent = truncatedSnippet;
        card.append(tag, snippet);
        sourcesGrid.appendChild(card);
    });
    
    // Auto-expand sources panel with peek animation
    if (!sourcesPanel.classList.contains('peeked')) {
        sourcesPanel.classList.add('peeked');
        setTimeout(() => {
            sourcesPanel.classList.remove('peeked');
        }, 1500);
    }
};

const sendMessage = async (text) => {
    const startTime = Date.now();
    const previousHistory = history.slice(-16);
    addMessage("user", text);
    history.push({ role: "user", content: text });
    
    const typingIndicator = addTyping();
    
    let fullReply = "";
    let contexts = [];
    let botMsg = null;
    let contentSpan = null;
    let cursorSpan = null;
    
    const retryFn = () => sendMessage(text);
    
    try {
        const res = await fetch("/api/chat/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, history: previousHistory, model: modelConfig }),
        });
        if (!res.ok) {
            let message = 'The selected model provider is unavailable.';
            const error = await res.json().catch(() => null);
            if (typeof error?.detail === 'string') message = error.detail;
            throw new Error(message);
        }
        
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        
        const tokenQueue = [];
        let isRendering = false;
        
        const renderNextToken = () => {
            if (tokenQueue.length === 0) {
                isRendering = false;
                return;
            }
            isRendering = true;
            const token = tokenQueue.shift();
            
            if (!botMsg) {
                typingIndicator.remove();
                botMsg = document.createElement("div");
                botMsg.className = "message bot";
                
                const responseTime = ((Date.now() - startTime) / 1000).toFixed(1);
                
                botMsg.innerHTML = `
                    <div class="bubble">
                        <div class="message-header">
                            <div class="label">Assistant</div>
                            <span class="timestamp">${formatTime(new Date())}</span>
                        </div>
                        <span class="content"></span>
                        <span class="cursor">▊</span>
                        <div class="message-actions" style="display:none;">
                            <button class="action-btn copy-btn">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy
                            </button>
                            <span class="response-time">Response time: ${responseTime}s</span>
                        </div>
                    </div>
                `;
                chatWindow.appendChild(botMsg);
                contentSpan = botMsg.querySelector(".content");
                cursorSpan = botMsg.querySelector(".cursor");
                
                const copyBtn = botMsg.querySelector('.copy-btn');
                copyBtn.onclick = () => copyMessage(fullReply, copyBtn);
            }
            fullReply += token;
            contentSpan.innerHTML = parseMarkdown(fullReply);
            chatWindow.scrollTop = chatWindow.scrollHeight;
            
            setTimeout(renderNextToken, 30);
        };
        
        let eventBuffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            eventBuffer += decoder.decode(value, { stream: true });
            const events = eventBuffer.split("\n\n");
            eventBuffer = events.pop() || '';

            for (const event of events) {
                const dataText = event.split("\n")
                    .filter(line => line.startsWith("data: "))
                    .map(line => line.slice(6))
                    .join("\n");
                if (dataText) {
                    const data = JSON.parse(dataText);
                        if (data.type === "contexts") {
                            contexts = data.contexts;
                            updateSources(contexts, data.confidence, data.confidence_message, data.cached || false);
                        } else if (data.type === "token") {
                            tokenQueue.push(data.token);
                            if (!isRendering) renderNextToken();
                        } else if (data.type === "done") {
                            const waitForQueue = () => {
                                if (tokenQueue.length === 0 && !isRendering) {
                                    if (cursorSpan) cursorSpan.remove();
                                    const actions = botMsg?.querySelector('.message-actions');
                                    if (actions) actions.style.display = 'flex';
                                    history.push({ role: "assistant", content: fullReply });
                                } else {
                                    setTimeout(waitForQueue, 50);
                                }
                            };
                            waitForQueue();
                        } else if (data.type === "error") {
                            throw new Error(data.message || 'The model stopped unexpectedly.');
                        }
                }
            }
        }
        
        if (cursorSpan && cursorSpan.parentNode) cursorSpan.remove();
        
    } catch (err) {
        if (typingIndicator.isConnected) typingIndicator.remove();
        if (cursorSpan?.isConnected) cursorSpan.remove();
        addErrorMessage(err.message, retryFn);
    }
};

// Character counter
const updateCharCount = () => {
    const maxChars = 500;
    const count = input.value.length;
    const counter = document.getElementById('char-counter');
    if (counter) {
        counter.textContent = `${count}/${maxChars}`;
        counter.classList.toggle('warning', count > maxChars * 0.8);
        counter.classList.toggle('danger', count >= maxChars);
    }
};

form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    input.classList.remove('has-text');
    updateCharCount();
    sendMessage(text);
});

input.addEventListener("input", () => {
    const sendBtn = form.querySelector('.send-btn');
    if (input.value.trim()) {
        input.classList.add('has-text');
        sendBtn.classList.add('ready');
    } else {
        input.classList.remove('has-text');
        sendBtn.classList.remove('ready');
    }
    updateCharCount();
});

input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event("submit"));
    }
});

// Prefetch/warmup on input focus - reduces first request latency
let hasWarmedUp = false;
input.addEventListener("focus", async () => {
    if (!hasWarmedUp && modelConfig.provider === 'ollama') {
        hasWarmedUp = true;
        try {
            await fetch("/api/warmup", { method: "POST" });
            console.log("🔥 Connection warmed up");
        } catch (e) {
            // Silently fail - warmup is optional
        }
    }
});

// Quick suggestion chips
document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        const query = chip.dataset.query;
        if (query) {
            const suggestions = chip.closest('.quick-suggestions');
            if (suggestions) {
                suggestions.style.opacity = '0';
                setTimeout(() => suggestions.remove(), 300);
            }
            sendMessage(query);
        }
    });
});

const checkHealth = async () => {
    try {
        const res = await fetch("/health");
        const data = await res.json();
        if (data.llm_ready) {
            const provider = data.llm_provider === 'ollama' ? 'Local' : 'API';
            modelPill.textContent = `${provider}: ${data.llm_model}`;
        } else {
            modelPill.textContent = "Model missing";
            modelPill.classList.remove('status-dot');
            modelPill.style.background = "rgba(255, 174, 92, 0.35)";
        }
        const ragPill = document.getElementById('rag-pill');
        if (!data.rag_ready && ragPill) {
            ragPill.textContent = 'RAG unavailable';
            ragPill.style.background = 'rgba(255, 80, 80, 0.35)';
        }
    } catch (err) {
        modelPill.textContent = "Offline";
        modelPill.style.background = "rgba(255, 80, 80, 0.35)";
    }
};

checkHealth();

// Model provider settings. API credentials remain only in this page's memory.
const modelDialog = document.getElementById('model-dialog');
const modelSettingsButton = document.getElementById('model-settings-btn');
const modelSettingsForm = document.getElementById('model-settings-form');
const settingsError = document.getElementById('settings-error');
const providerNote = document.getElementById('provider-note');
const providerButtons = [...document.querySelectorAll('.provider-option')];
const ollamaFields = document.getElementById('ollama-fields');
const apiFields = document.getElementById('api-fields');
let pendingProvider = modelConfig.provider;

const setProviderTab = (provider) => {
    pendingProvider = provider;
    providerButtons.forEach(button => {
        const selected = button.dataset.provider === provider;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    ollamaFields.classList.toggle('hidden', provider !== 'ollama');
    apiFields.classList.toggle('hidden', provider !== 'api');
    providerNote.textContent = provider === 'api'
        ? 'The key stays in memory for this tab and is sent only to your selected endpoint.'
        : 'Runs on your machine through Ollama.';
    settingsError.textContent = '';
};

const openModelSettings = () => {
    document.getElementById('ollama-model').value = modelConfig.ollama_model;
    document.getElementById('ollama-url').value = modelConfig.ollama_base_url;
    document.getElementById('api-model').value = modelConfig.api_model;
    document.getElementById('api-base-url').value = modelConfig.api_base_url;
    document.getElementById('api-key').value = modelConfig.api_key;
    setProviderTab(modelConfig.provider);
    modelDialog.showModal();
};

const closeModelSettings = () => {
    settingsError.textContent = '';
    modelDialog.close();
};

providerButtons.forEach(button => {
    button.addEventListener('click', () => setProviderTab(button.dataset.provider));
});
modelSettingsButton.addEventListener('click', openModelSettings);
document.getElementById('model-dialog-close').addEventListener('click', closeModelSettings);
document.getElementById('model-settings-cancel').addEventListener('click', closeModelSettings);

document.getElementById('toggle-api-key').addEventListener('click', (event) => {
    const keyInput = document.getElementById('api-key');
    const showing = keyInput.type === 'text';
    keyInput.type = showing ? 'password' : 'text';
    event.currentTarget.textContent = showing ? 'Show' : 'Hide';
});

modelDialog.addEventListener('click', (event) => {
    if (event.target === modelDialog) closeModelSettings();
});

modelSettingsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const nextConfig = {
        provider: pendingProvider,
        ollama_model: document.getElementById('ollama-model').value.trim(),
        ollama_base_url: document.getElementById('ollama-url').value.trim(),
        api_model: document.getElementById('api-model').value.trim(),
        api_base_url: document.getElementById('api-base-url').value.trim(),
        api_key: document.getElementById('api-key').value.trim(),
    };

    if (pendingProvider === 'ollama' && (!nextConfig.ollama_model || !nextConfig.ollama_base_url)) {
        settingsError.textContent = 'Enter both the Ollama model and URL.';
        return;
    }
    if (pendingProvider === 'api' && (!nextConfig.api_model || !nextConfig.api_base_url || !nextConfig.api_key)) {
        settingsError.textContent = 'Enter the API URL, model, and key.';
        return;
    }
    if (pendingProvider === 'api') {
        try {
            const url = new URL(nextConfig.api_base_url);
            const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
            if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error();
        } catch {
            settingsError.textContent = 'Use an HTTPS API URL (HTTP is allowed only for localhost).';
            return;
        }
    }

    modelConfig = nextConfig;
    hasWarmedUp = false;
    modelPill.classList.add('status-dot');
    modelPill.style.background = '';
    modelPill.textContent = pendingProvider === 'api'
        ? `API: ${nextConfig.api_model}`
        : `Local: ${nextConfig.ollama_model}`;
    closeModelSettings();
});
