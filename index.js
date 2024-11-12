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

// Settings management functions
function loadSettingsFromLocalStorage() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    const settings = extension_settings[extensionName];
    
    $('#translation_prompt').val(settings.prompt || 'Translate the following English text to Korean:');
    $('#model_select').val(settings.model || 'openai');
    $('#submodel_select').val(settings.submodel || 'gpt-3.5-turbo-0125');
}

function saveSettingsToLocalStorage() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    const settings = extension_settings[extensionName];
    
    settings.prompt = $('#translation_prompt').val();
    settings.model = $('#model_select').val();
    settings.submodel = $('#submodel_select').val();
    
    saveSettingsDebounced();
}

// Modified initialization function
function initializeExtension() {
    console.log("Initializing LLM Translator...");
    
    // Add buttons to all existing messages immediately
    setTimeout(() => {
        const messages = $('#chat .mes');
        messages.each(function() {
            const messageId = $(this).attr('mesid');
            if (messageId && !$(this).find('.translate-icons').length) {
                addButtonsToMessage($(this), messageId);
            }
        });
    }, 1000);
}

// Modified function to add buttons with icons
function addButtonsToMessage(messageElement, messageId) {
    const buttonHtml = `
        <div class="translate-icons" style="display: inline-block; margin-left: 5px;">
            <div class="translate-button fa-solid fa-language" 
                 data-message-id="${messageId}" 
                 style="cursor: pointer; margin-right: 5px;"
                 title="Translate">
            </div>
            <div class="toggle-original-button fa-solid fa-rotate" 
                 data-message-id="${messageId}" 
                 style="cursor: pointer; display: none;"
                 title="Show Original">
            </div>
        </div>
    `;
    
    // Add icons next to the message timestamp
    messageElement.find('.mes_block .mes_text').before(buttonHtml);
    bindButtonEvents(messageId);
}

async function requestTranslationFromAPI(text) {
    if (!text || text.trim() === '') {
        console.warn("Empty text provided for translation");
        return null;
    }

    const settings = extension_settings[extensionName] || {};
    const selectedCompany = settings.model || "openai";
    const selectedSubModel = settings.submodel || "gpt-3.5-turbo-0125";
    const translationPrompt = settings.prompt || "Translate the following English text to Korean:";

    let apiEndpoint;
    let requestBody;

    switch(selectedCompany) {
        case 'openai':
            apiEndpoint = '/api/openai/chat/completions';  // Use SillyTavern's proxy
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
            apiEndpoint = '/api/claude/chat';  // Use SillyTavern's proxy
            requestBody = {
                model: selectedSubModel,
                messages: [{
                    role: "user",
                    content: `${translationPrompt}\n\n${text}`
                }]
            };
            break;
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

// Modified button event binding with icon support
function bindButtonEvents(messageId) {
    $(document).off('click', `.translate-button[data-message-id="${messageId}"]`)
        .on('click', `.translate-button[data-message-id="${messageId}"]`, async function() {
            const messageElement = $(`#chat .mes[mesid="${messageId}"]`);
            const messageText = messageElement.find('.mes_text').text().trim();
            
            // Store original text
            messageElement.attr('data-original-text', messageText);
            
            // Show loading state
            $(this).addClass('fa-spin');
            
            const translatedText = await requestTranslationFromAPI(messageText);
            
            if (translatedText) {
                messageElement.find('.mes_text').text(translatedText);
                messageElement.find('.toggle-original-button').show();
                $(this).hide();
            }
            
            // Reset loading state
            $(this).removeClass('fa-spin');
        });

    $(document).off('click', `.toggle-original-button[data-message-id="${messageId}"]`)
        .on('click', `.toggle-original-button[data-message-id="${messageId}"]`, function() {
            const messageElement = $(`#chat .mes[mesid="${messageId}"]`);
            const originalText = messageElement.attr('data-original-text');
            const currentText = messageElement.find('.mes_text').text();
            
            if (currentText !== originalText) {
                // Show original
                messageElement.find('.mes_text').text(originalText);
                $(this).attr('title', 'Show Translation');
                messageElement.find('.translate-button').show();
                $(this).hide();
            }
        });
}

// Add event listeners for new messages
function addEventListeners() {
    eventSource.on(event_types.MESSAGE_SENT, function() {
        setTimeout(() => addButtonsToMessages(), 100);
    });
    eventSource.on(event_types.MESSAGE_RECEIVED, function() {
        setTimeout(() => addButtonsToMessages(), 100);
    });
}

function addButtonsToMessages() {
    const messages = $('#chat .mes');
    messages.each(function() {
        const messageId = $(this).attr('mesid');
        if (messageId && !$(this).find('.translate-icons').length) {
            addButtonsToMessage($(this), messageId);
        }
    });
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
        
        // Add settings save handler
        $('#translation_prompt, #model_select, #submodel_select').on('change', saveSettingsToLocalStorage);
        
    } catch (err) {
        console.error("Error during LLM Translator initialization:", err);
    }
});
