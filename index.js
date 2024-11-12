// index.js

import {
    extension_settings,
    getContext,
} from "../../../extensions.js";
import { updateMessageBlock, saveSettingsDebounced, getRequestHeaders } from "../../../../script.js";
import { eventSource, event_types } from "../../../../script.js";

const extensionName = "llm-translator";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const translationFolderPath = './data/translations';

// Modified initialization function to ensure buttons are added on page load
function initializeExtension() {
    console.log("Initializing LLM Translator...");
    
    // Add buttons to all existing messages immediately
    setTimeout(() => {
        const messages = $('#chat .mes');
        messages.each(function() {
            const messageId = $(this).attr('mesid');
            if (messageId && !$(this).find('.translate-button').length) {
                addButtonsToMessage($(this), messageId);
            }
        });
    }, 1000); // Allow time for chat to load
}

// Separate function to add buttons to a single message
function addButtonsToMessage(messageElement, messageId) {
    const buttonHtml = `
        <div class="message-buttons">
            <button class="translate-button" data-message-id="${messageId}">Translate</button>
            <button class="toggle-original-button" data-message-id="${messageId}" style="display:none">Show Original</button>
        </div>
    `;
    
    messageElement.find('.mes_block').prepend(buttonHtml);
    bindButtonEvents(messageId);
}

// Modified translation request function
async function requestTranslationFromAPI(text) {
    if (!text || text.trim() === '') {
        console.warn("Empty text provided for translation");
        return null;
    }

    const selectedCompany = extension_settings?.[extensionName]?.model || "openai";
    const selectedSubModel = extension_settings?.[extensionName]?.submodel || "gpt-3.5-turbo-0125";
    const translationPrompt = $('#translation_prompt').val() || "Translate the following English text to Korean:";

    let apiEndpoint;
    let requestBody;

    switch(selectedCompany) {
        case 'openai':
            apiEndpoint = 'https://api.openai.com/v1/chat/completions';
            requestBody = {
                model: selectedSubModel,
                messages: [
                    {
                        role: "system",
                        content: translationPrompt
                    },
                    {
                        role: "user",
                        content: text
                    }
                ]
            };
            break;
        case 'claude':
            apiEndpoint = 'https://api.anthropic.com/v1/messages';
            requestBody = {
                model: selectedSubModel,
                messages: [{
                    role: "user",
                    content: `${translationPrompt}\n\n${text}`
                }]
            };
            break;
        // Add other cases as needed
        default:
            throw new Error('Unsupported model selected');
    }

    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const translatedText = data.choices?.[0]?.message?.content || data.choices?.[0]?.text;
        
        if (!translatedText) {
            throw new Error('No translation received from API');
        }

        return translatedText;
    } catch (error) {
        console.error("Translation error:", error);
        alert(`Translation failed: ${error.message}`);
        return null;
    }
}

// Modified button event binding
function bindButtonEvents(messageId) {
    $(document).off('click', `.translate-button[data-message-id="${messageId}"]`)
        .on('click', `.translate-button[data-message-id="${messageId}"]`, async function() {
            const messageElement = $(`#chat .mes[mesid="${messageId}"]`);
            const messageText = messageElement.find('.mes_text').text().trim();
            
            // Show loading state
            $(this).prop('disabled', true).text('Translating...');
            
            const translatedText = await requestTranslationFromAPI(messageText);
            
            if (translatedText) {
                // Save translation
                saveSwipeTranslationToFile(getContext().room_id, messageId, 0, translatedText);
                
                // Update display
                messageElement.find('.mes_text').text(translatedText);
                messageElement.find('.toggle-original-button').show();
                $(this).hide();
            }
            
            // Reset button state
            $(this).prop('disabled', false).text('Translate');
        });

    $(document).off('click', `.toggle-original-button[data-message-id="${messageId}"]`)
        .on('click', `.toggle-original-button[data-message-id="${messageId}"]`, function() {
            const messageElement = $(`#chat .mes[mesid="${messageId}"]`);
            const isShowingTranslation = $(this).text() === 'Show Original';
            
            if (isShowingTranslation) {
                // Show original
                const originalText = loadOriginalText(messageId);
                messageElement.find('.mes_text').text(originalText);
                $(this).text('Show Translation');
                messageElement.find('.translate-button').show();
            } else {
                // Show translation
                const translatedText = loadSwipeTranslationFromFile(getContext().room_id, messageId, 0);
                if (translatedText) {
                    messageElement.find('.mes_text').text(translatedText);
                    $(this).text('Show Original');
                    messageElement.find('.translate-button').hide();
                }
            }
        });
}

// Add event listeners for new messages
function addEventListeners() {
    eventSource.on(event_types.MESSAGE_SENT, addButtonsToMessages);
    eventSource.on(event_types.MESSAGE_RECEIVED, addButtonsToMessages);
}

// Initialize extension when document is ready
jQuery(async () => {
    console.log("LLM Translator script initializing...");
    
    try {
        await new Promise(resolve => setTimeout(resolve, 900));
        
        const htmlContent = await $.get(`${extensionFolderPath}/example.html`);
        $("#extensions_settings").append(htmlContent);
        
        loadSettingsFromLocalStorage();
        initializeExtension();
        addEventListeners();
        
    } catch (err) {
        console.error("Error during LLM Translator initialization:", err);
    }
});
