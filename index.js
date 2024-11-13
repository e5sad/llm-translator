import {
    extension_settings,
    getContext,
} from "../../../extensions.js";
import { updateMessageBlock, saveSettingsDebounced, getRequestHeaders } from "../../../../script.js";
import { eventSource, event_types } from "../../../../script.js";
import { saveAs } from 'file-saver';

const extensionName = "llm-translator";
const translationFilePath = 'translations.txt';

// Translation storage management
async function saveTranslationToFile(messageId, translatedText) {
    try {
        const translations = await loadTranslationsFromFile();
        translations[messageId] = translatedText;
        
        // Convert to string format for text file
        const translationText = Object.entries(translations)
            .map(([id, text]) => `${id}|||${text}`)
            .join('\n');
            
        const blob = new Blob([translationText], {type: 'text/plain;charset=utf-8'});
        saveAs(blob, translationFilePath);
    } catch (error) {
        console.error('Failed to save translation:', error);
    }
}

async function loadTranslationsFromFile() {
    try {
        const response = await fetch(translationFilePath);
        const text = await response.text();
        const translations = {};
        
        text.split('\n').forEach(line => {
            if (line) {
                const [id, translation] = line.split('|||');
                translations[id] = translation;
            }
        });
        
        return translations;
    } catch (error) {
        console.error('Failed to load translations:', error);
        return {};
    }
}

// Add translation buttons to messages
function addButtonsToMessage(messageElement, messageId) {
    const buttonHtml = `
        <div class="translate-icons" style="display: inline-block; margin-left: 5px;">
            <div class="translate-button fa-solid fa-globe"
                 data-message-id="${messageId}"
                 style="cursor: pointer; margin-right: 5px;"
                 title="Translate">
            </div>
            <div class="toggle-original-button fa-solid fa-eye"
                 data-message-id="${messageId}"
                 style="cursor: pointer; display: none;"
                 title="Show Original">
            </div>
        </div>
    `;

    messageElement.find('.mes_block .mes_text').before(buttonHtml);
    bindButtonEvents(messageId);
}

let activeTranslations = new Set();

function bindButtonEvents(messageId) {
    $(document).off('click', `.translate-button[data-message-id="${messageId}"]`)
        .on('click', `.translate-button[data-message-id="${messageId}"]`, async function() {
            const $button = $(this);
            
            // If translation is in progress
            if ($button.hasClass('fa-spin')) {
                activeTranslations.delete(messageId);
                $button.removeClass('fa-spin');
                return;
            }

            const messageElement = $(`#chat .mes[mesid="${messageId}"]`);
            const messageText = messageElement.find('.mes_text').text().trim();

            // Store original text
            messageElement.attr('data-original-text', messageText);
            
            // Check for existing translation first
            const translations = await loadTranslationsFromFile();
            let translatedText = translations[messageId];

            // If requesting new translation
            if ($button.hasClass('translation-active')) {
                translatedText = null;
            }

            if (!translatedText) {
                activeTranslations.add(messageId);
                $button.addClass('fa-spin');

                try {
                    translatedText = await requestTranslationFromAPI(messageText);
                    
                    // Only proceed if translation wasn't cancelled
                    if (activeTranslations.has(messageId)) {
                        if (translatedText) {
                            await saveTranslationToFile(messageId, translatedText);
                            messageElement.find('.mes_text').text(translatedText);
                            messageElement.find('.toggle-original-button').show();
                            $button.hide().removeClass('fa-spin');
                        }
                    }
                } catch (error) {
                    console.error('Translation error:', error);
                } finally {
                    activeTranslations.delete(messageId);
                    $button.removeClass('fa-spin');
                }
            } else {
                messageElement.find('.mes_text').text(translatedText);
                messageElement.find('.toggle-original-button').show();
                $button.hide();
            }

            $button.toggleClass('translation-active');
        });

    $(document).off('click', `.toggle-original-button[data-message-id="${messageId}"]`)
        .on('click', `.toggle-original-button[data-message-id="${messageId}"]`, async function() {
            const messageElement = $(`#chat .mes[mesid="${messageId}"]`);
            const originalText = messageElement.attr('data-original-text');
            const currentText = messageElement.find('.mes_text').text();

            if (currentText !== originalText) {
                // Show original text
                messageElement.find('.mes_text').text(originalText);
                $(this).attr('title', 'Show Translation');
                messageElement.find('.translate-button').show();
                $(this).hide();
            } else {
                // Show translation from file
                const translations = await loadTranslationsFromFile();
                const translatedText = translations[messageId];
                
                if (translatedText) {
                    messageElement.find('.mes_text').text(translatedText);
                    $(this).attr('title', 'Show Original');
                    messageElement.find('.translate-button').hide();
                    $(this).show();
                }
            }
        });
}

async function requestTranslationFromAPI(text) {
    if (!text || text.trim() === '') {
        console.warn("Empty text provided for translation");
        return null;
    }

    const settings = extension_settings[extensionName] || {};
    const selectedModel = settings.model || "openai";
    const selectedSubModel = settings.submodel || "gpt-3.5-turbo";
    const translationPrompt = settings.prompt || "Translate the following English text to Korean:";

    try {
        const response = await fetch('/api/openai/chat/completions', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                model: selectedSubModel,
                messages: [
                    { role: "system", content: translationPrompt },
                    { role: "user", content: text }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`API Error (${response.status})`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content;

    } catch (error) {
        console.error("Translation error:", error);
        return null;
    }
}

// Initialize extension
jQuery(async () => {
    console.log("LLM Translator initializing...");
    
    // Add translation buttons to existing messages
    const messages = $('#chat .mes');
    messages.each(function() {
        const messageId = $(this).attr('mesid');
        if (messageId && !$(this).find('.translate-icons').length) {
            addButtonsToMessage($(this), messageId);
        }
    });

    // Listen for new messages
    eventSource.on(event_types.MESSAGE_SENT, () => {
        setTimeout(() => {
            const messages = $('#chat .mes');
            messages.each(function() {
                const messageId = $(this).attr('mesid');
                if (messageId && !$(this).find('.translate-icons').length) {
                    addButtonsToMessage($(this), messageId);
                }
            });
        }, 100);
    });
});
