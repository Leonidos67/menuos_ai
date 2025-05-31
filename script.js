const messageForm = document.querySelector(".prompt__form");
const chatHistoryContainer = document.querySelector(".chats");
const suggestionItems = document.querySelectorAll(".suggests__item");
const themeToggleButton = document.getElementById("themeToggler");
const deleteButton = document.getElementById("deleteButton");

// State variables
let currentUserMessage = null;
let isGeneratingResponse = false;

const GOOGLE_API_KEY = "AIzaSyA00pA-siqQ7DDBi-gYQ4q2gwuqcDTfQbc";
const API_REQUEST_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;

// Load saved data from local storage
const loadSavedChatHistory = () => {
    const savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
    const isLightTheme = localStorage.getItem("themeColor") === "light_mode";

    document.body.classList.toggle("light_mode", isLightTheme);
    themeToggleButton.innerHTML = isLightTheme ? '<i class="bx bx-moon"></i>' : '<i class="bx bx-sun"></i>';

    chatHistoryContainer.innerHTML = '';

    // Iterate through saved chat history and display messages
    savedConversations.forEach(conversation => {
        // Display the user's message
        const userMessageHtml = `

            <div class="message__content">
                <img class="message__avatar" src="assets/profile.png" alt="User avatar">
               <p class="message__text">${conversation.userMessage}</p>
            </div>
        
        `;

        const outgoingMessageElement = createChatMessageElement(userMessageHtml, "message--outgoing");
        chatHistoryContainer.appendChild(outgoingMessageElement);

        // Display the API response
        const responseText = conversation.apiResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsedApiResponse = marked.parse(responseText); // Convert to HTML
        const rawApiResponse = responseText; // Plain text version

        const responseHtml = `

            <div class="message__content">
                <img class="message__avatar" src="assets/gemini.svg" alt="Gemini avatar">
                <p class="message__text"></p>
                <div class="message__loading-indicator hide">
                    <div class="message__loading-bar"></div>
                    <div class="message__loading-bar"></div>
                    <div class="message__loading-bar"></div>
                </div>
            </div>
            <span onClick="copyMessageToClipboard(this)" class="message__icon hide">
                <span class="copy-text">Скопировать</span>
                <i class='bx bx-copy-alt'></i>
            </span>
            <span onClick="handleNewChat()" class="message__icon message__icon-margin hide">
                <span class="copy-text">Новый чат</span>
                <i class='bx bx-plus'></i>
            </span>
            <span onClick="handleLike(this)" class="message__icon message__icon-margin hide">
                <i class='bx bx-like'></i>
            </span>
            <span onClick="handleDislike(this)" class="message__icon message__icon-margin hide">
                <i class='bx bx-dislike'></i>
            </span>
            <span onClick="handleHeart(this)" class="message__icon message__icon-margin hide">
                <i class='bx bx-heart'></i>
            </span>
        
        `;

        const incomingMessageElement = createChatMessageElement(responseHtml, "message--incoming");
        chatHistoryContainer.appendChild(incomingMessageElement);

        const messageTextElement = incomingMessageElement.querySelector(".message__text");

        // Display saved chat without typing effect
        showTypingEffect(rawApiResponse, parsedApiResponse, messageTextElement, incomingMessageElement, true); // 'true' skips typing
    });

    document.body.classList.toggle("hide-header", savedConversations.length > 0);
};

// create a new chat message element
const createChatMessageElement = (htmlContent, ...cssClasses) => {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", ...cssClasses);
    messageElement.innerHTML = htmlContent;
    messageElement.dataset.messageId = Date.now().toString(); // Добавляем уникальный ID
    return messageElement;
}

// Show typing effect
const showTypingEffect = (rawText, htmlText, messageElement, incomingMessageElement, skipEffect = false) => {
    const copyIconElement = incomingMessageElement.querySelector(".message__icon");
    const newChatIconElement = incomingMessageElement.querySelector(".message__icon-margin");
    const likeIconElement = incomingMessageElement.querySelector(".message__icon:nth-child(4)");
    const dislikeIconElement = incomingMessageElement.querySelector(".message__icon:nth-child(5)");
    const heartIconElement = incomingMessageElement.querySelector(".message__icon:nth-child(6)");
    
    copyIconElement.classList.add("hide");
    newChatIconElement.classList.add("hide");
    likeIconElement.classList.add("hide");
    dislikeIconElement.classList.add("hide");
    heartIconElement.classList.add("hide");

    // Проверяем сохраненное состояние реакций
    const messageId = incomingMessageElement.dataset.messageId;
    if (messageId) {
        const savedReaction = localStorage.getItem(`message_${messageId}_reaction`);
        if (savedReaction === 'like') {
            likeIconElement.classList.add('active');
        } else if (savedReaction === 'dislike') {
            dislikeIconElement.classList.add('active');
        } else if (savedReaction === 'heart') {
            heartIconElement.classList.add('active');
        }
    }

    if (skipEffect) {
        messageElement.innerHTML = htmlText;
        hljs.highlightAll();
        addCopyButtonToCodeBlocks();
        copyIconElement.classList.remove("hide");
        newChatIconElement.classList.remove("hide");
        likeIconElement.classList.remove("hide");
        dislikeIconElement.classList.remove("hide");
        heartIconElement.classList.remove("hide");
        isGeneratingResponse = false;
        return;
    }

    const wordsArray = rawText.split(' ');
    let wordIndex = 0;

    const typingInterval = setInterval(() => {
        messageElement.innerText += (wordIndex === 0 ? '' : ' ') + wordsArray[wordIndex++];
        if (wordIndex === wordsArray.length) {
            clearInterval(typingInterval);
            isGeneratingResponse = false;
            messageElement.innerHTML = htmlText;
            hljs.highlightAll();
            addCopyButtonToCodeBlocks();
            copyIconElement.classList.remove("hide");
            newChatIconElement.classList.remove("hide");
            likeIconElement.classList.remove("hide");
            dislikeIconElement.classList.remove("hide");
            heartIconElement.classList.remove("hide");
        }
    }, 75);
};

// Fetch API response based on user input
const requestApiResponse = async (incomingMessageElement) => {
    const messageTextElement = incomingMessageElement.querySelector(".message__text");

    try {
        const response = await fetch(API_REQUEST_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: currentUserMessage }] }]
            }),
        });

        const responseData = await response.json();
        if (!response.ok) throw new Error(responseData.error.message);

        const responseText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) throw new Error("Invalid API response.");

        const parsedApiResponse = marked.parse(responseText);
        const rawApiResponse = responseText;

        showTypingEffect(rawApiResponse, parsedApiResponse, messageTextElement, incomingMessageElement);

        // Save conversation in local storage
        let savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
        savedConversations.push({
            userMessage: currentUserMessage,
            apiResponse: responseData
        });
        localStorage.setItem("saved-api-chats", JSON.stringify(savedConversations));
    } catch (error) {
        isGeneratingResponse = false;
        messageTextElement.innerText = error.message;
        messageTextElement.closest(".message").classList.add("message--error");
    } finally {
        incomingMessageElement.classList.remove("message--loading");
    }
};

// Add copy button to code blocks
const addCopyButtonToCodeBlocks = () => {
    const codeBlocks = document.querySelectorAll('pre');
    codeBlocks.forEach((block) => {
        const codeElement = block.querySelector('code');
        let language = [...codeElement.classList].find(cls => cls.startsWith('language-'))?.replace('language-', '') || 'Text';

        const languageLabel = document.createElement('div');
        languageLabel.innerText = language.charAt(0).toUpperCase() + language.slice(1);
        languageLabel.classList.add('code__language-label');
        block.appendChild(languageLabel);

        const copyButton = document.createElement('button');
        copyButton.innerHTML = `<i class='bx bx-copy'></i>`;
        copyButton.classList.add('code__copy-btn');
        block.appendChild(copyButton);

        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(codeElement.innerText).then(() => {
                copyButton.innerHTML = `<i class='bx bx-check'></i>`;
                setTimeout(() => copyButton.innerHTML = `<i class='bx bx-copy'></i>`, 2000);
            }).catch(err => {
                console.error("Copy failed:", err);
                alert("Unable to copy text!");
            });
        });
    });
};

// Show loading animation during API request
const displayLoadingAnimation = () => {
    const loadingHtml = `

        <div class="message__content">
            <img class="message__avatar" src="assets/gemini.svg" alt="Gemini avatar">
            <p class="message__text"></p>
            <div class="message__loading-indicator hide">
                <div class="message__loading-bar"></div>
                <div class="message__loading-bar"></div>
                <div class="message__loading-bar"></div>
            </div>
        </div>
        <span onClick="copyMessageToClipboard(this)" class="message__icon hide">
            <span class="copy-text">Скопировать</span>
            <i class='bx bx-copy-alt'></i>
        </span>
        <span onClick="handleNewChat()" class="message__icon message__icon-margin hide">
            <span class="copy-text">Новый чат</span>
            <i class='bx bx-plus'></i>
        </span>
        <span onClick="handleLike(this)" class="message__icon message__icon-margin hide">
            <i class='bx bx-like'></i>
        </span>
        <span onClick="handleDislike(this)" class="message__icon message__icon-margin hide">
            <i class='bx bx-dislike'></i>
        </span>
        <span onClick="handleHeart(this)" class="message__icon message__icon-margin hide">
            <i class='bx bx-heart'></i>
        </span>
    
    `;

    const loadingMessageElement = createChatMessageElement(loadingHtml, "message--incoming", "message--loading");
    chatHistoryContainer.appendChild(loadingMessageElement);

    requestApiResponse(loadingMessageElement);
};

// Copy message to clipboard
const copyMessageToClipboard = (copyButton) => {
    const messageContent = copyButton.parentElement.querySelector(".message__text").innerText;
    const copyText = copyButton.querySelector(".copy-text");

    navigator.clipboard.writeText(messageContent);
    copyButton.querySelector("i").className = 'bx bx-check';
    copyText.textContent = 'Скопировать';
    
    setTimeout(() => {
        copyButton.querySelector("i").className = 'bx bx-copy-alt';
        copyText.textContent = 'Скопировать';
    }, 1000);
};

// Handle new chat button click
const handleNewChat = () => {
    if (confirm("Вы уверены, что хотите начать новый чат?")) {
        localStorage.removeItem("saved-api-chats");
        chatHistoryContainer.innerHTML = '';
        currentUserMessage = null;
        isGeneratingResponse = false;
        document.body.classList.remove("hide-header");
    }
};

// Add event listener for new chat button
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('new-chat-btn')) {
        handleNewChat();
    }
});

// Handle sending chat messages
const handleOutgoingMessage = () => {
    currentUserMessage = messageForm.querySelector(".prompt__form-input").value.trim() || currentUserMessage;
    if (!currentUserMessage || isGeneratingResponse) return; // Exit if no message or already generating response

    isGeneratingResponse = true;

    const outgoingMessageHtml = `
    
        <div class="message__content">
            <img class="message__avatar" src="assets/profile.png" alt="User avatar">
            <p class="message__text"></p>
        </div>

    `;

    const outgoingMessageElement = createChatMessageElement(outgoingMessageHtml, "message--outgoing");
    outgoingMessageElement.querySelector(".message__text").innerText = currentUserMessage;
    chatHistoryContainer.appendChild(outgoingMessageElement);

    messageForm.reset(); // Clear input field
    document.body.classList.add("hide-header");
    setTimeout(displayLoadingAnimation, 500); // Show loading animation after delay
};

// Toggle between light and dark themes
themeToggleButton.addEventListener('click', () => {
    const isLightTheme = document.body.classList.toggle("light_mode");
    localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");

    // Update icon based on theme
    const newIconClass = isLightTheme ? "bx bx-moon" : "bx bx-sun";
    themeToggleButton.querySelector("i").className = newIconClass;
});

// Clear all chat history
deleteButton.addEventListener('click', () => {
    if (confirm("Вы уверены, что хотите удалить всю историю чата?")) {
        localStorage.removeItem("saved-api-chats");
        loadSavedChatHistory();
        currentUserMessage = null;
        isGeneratingResponse = false;
    }
});

// Handle click on suggestion items
suggestionItems.forEach(suggestion => {
    suggestion.addEventListener('click', () => {
        currentUserMessage = suggestion.querySelector(".suggests__item-text").innerText;
        handleOutgoingMessage();
    });
});

// Prevent default from submission and handle outgoing message
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleOutgoingMessage();
});

// Load saved chat history on page load
loadSavedChatHistory();

// Обработка выпадающего меню профиля
const profileButton = document.getElementById('profileButton');
const dropdownMenu = document.querySelector('.dropdown-menu');

profileButton.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('show');
});

// Закрытие меню при клике вне его
document.addEventListener('click', (e) => {
    if (!dropdownMenu.contains(e.target) && !profileButton.contains(e.target)) {
        dropdownMenu.classList.remove('show');
    }
});

// Функционал редактирования имени пользователя
document.addEventListener('DOMContentLoaded', function() {
    const usernameElement = document.querySelector('.header__title h2');
    const editIcon = document.querySelector('.icon-edit-profile');
    let isEditing = false;

    // Загружаем сохраненное имя при загрузке страницы
    const savedUsername = localStorage.getItem('username');
    if (savedUsername) {
        usernameElement.textContent = savedUsername;
    }

    editIcon.addEventListener('click', function() {
        if (!isEditing) {
            // Создаем поле ввода
            const input = document.createElement('input');
            input.type = 'text';
            input.value = usernameElement.textContent;
            input.className = 'username-input';
            
            // Заменяем текст на поле ввода
            usernameElement.textContent = '';
            usernameElement.appendChild(input);
            input.focus();
            
            isEditing = true;

            // Обработка сохранения при нажатии Enter или потере фокуса
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    saveUsername();
                }
            });

            input.addEventListener('blur', saveUsername);

            function saveUsername() {
                const newUsername = input.value.trim() || 'Гость';
                usernameElement.textContent = newUsername;
                localStorage.setItem('username', newUsername);
                isEditing = false;
            }
        }
    });
});

// Функция для создания частиц
const createParticles = (button, type) => {
    const rect = button.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Добавляем класс тряски к кнопке
    button.classList.add('shake');
    setTimeout(() => button.classList.remove('shake'), 500);

    // Массивы иконок для каждого типа реакции
    const likeIcons = ['bx-star', 'bx-bulb', 'bx-smile', 'bx-happy', 'bx-cool', 'bx-wink-smile'];
    const dislikeIcons = ['bx-sad', 'bx-angry', 'bx-confused', 'bx-tired', 'bx-dizzy', 'bx-meh'];
    const heartIcons = ['bx-gift', 'bx-cake', 'bx-crown', 'bx-diamond', 'bx-badge', 'bx-medal'];

    // Выбираем массив иконок в зависимости от типа
    let icons;
    switch(type) {
        case 'like':
            icons = likeIcons;
            break;
        case 'dislike':
            icons = dislikeIcons;
            break;
        case 'heart':
            icons = heartIcons;
            break;
    }

    // Создаем 12 частиц
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = `particle ${type}`;
        
        // Случайный угол и расстояние для каждой частицы
        const angle = (i * 30) + Math.random() * 30;
        const distance = 50 + Math.random() * 50;
        const tx = Math.cos(angle * Math.PI / 180) * distance;
        const ty = Math.sin(angle * Math.PI / 180) * distance;
        const tr = Math.random() * 360;
        
        // Устанавливаем CSS переменные для анимации
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        particle.style.setProperty('--tr', `${tr}deg`);
        
        // Выбираем случайную иконку из соответствующего массива
        const randomIcon = icons[Math.floor(Math.random() * icons.length)];
        particle.innerHTML = `<i class='bx ${randomIcon}'></i>`;
        
        particle.style.left = `${centerX}px`;
        particle.style.top = `${centerY}px`;
        
        document.body.appendChild(particle);
        
        // Запускаем анимацию
        particle.style.animation = 'particle 0.8s ease-out forwards';
        
        // Удаляем частицу после завершения анимации
        setTimeout(() => {
            particle.remove();
        }, 800);
    }
};

// Обновляем функции обработки реакций
const handleLike = (button) => {
    const messageElement = button.closest('.message');
    if (!messageElement) return;

    const likeButton = messageElement.querySelector('.message__icon:nth-child(4)');
    const dislikeButton = messageElement.querySelector('.message__icon:nth-child(5)');
    const heartButton = messageElement.querySelector('.message__icon:nth-child(6)');
    
    if (!likeButton || !dislikeButton || !heartButton) return;
    
    likeButton.classList.add('active');
    dislikeButton.classList.remove('active');
    heartButton.classList.remove('active');
    
    // Создаем эффект распыления
    createParticles(likeButton, 'like');
    
    // Сохраняем состояние в localStorage
    const messageId = messageElement.dataset.messageId;
    if (messageId) {
        localStorage.setItem(`message_${messageId}_reaction`, 'like');
    }
};

const handleDislike = (button) => {
    const messageElement = button.closest('.message');
    if (!messageElement) return;

    const likeButton = messageElement.querySelector('.message__icon:nth-child(4)');
    const dislikeButton = messageElement.querySelector('.message__icon:nth-child(5)');
    const heartButton = messageElement.querySelector('.message__icon:nth-child(6)');
    
    if (!likeButton || !dislikeButton || !heartButton) return;
    
    dislikeButton.classList.add('active');
    likeButton.classList.remove('active');
    heartButton.classList.remove('active');
    
    // Создаем эффект распыления
    createParticles(dislikeButton, 'dislike');
    
    // Сохраняем состояние в localStorage
    const messageId = messageElement.dataset.messageId;
    if (messageId) {
        localStorage.setItem(`message_${messageId}_reaction`, 'dislike');
    }
};

const handleHeart = (button) => {
    const messageElement = button.closest('.message');
    if (!messageElement) return;

    const likeButton = messageElement.querySelector('.message__icon:nth-child(4)');
    const dislikeButton = messageElement.querySelector('.message__icon:nth-child(5)');
    const heartButton = messageElement.querySelector('.message__icon:nth-child(6)');
    
    if (!likeButton || !dislikeButton || !heartButton) return;
    
    heartButton.classList.add('active');
    likeButton.classList.remove('active');
    dislikeButton.classList.remove('active');
    
    // Создаем эффект распыления
    createParticles(heartButton, 'heart');
    
    // Сохраняем состояние в localStorage
    const messageId = messageElement.dataset.messageId;
    if (messageId) {
        localStorage.setItem(`message_${messageId}_reaction`, 'heart');
    }
};