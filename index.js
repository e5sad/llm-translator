import {
    extension_settings,
    getContext,
} from "../../../extensions.js";
import { updateMessageBlock, saveSettingsDebounced, getRequestHeaders } from "../../../../script.js";
import { eventSource, event_types } from "../../../../script.js";

const fs = require('fs');
const extensionName = "llm-translator";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const translationFolderPath = './data/translations';

// Settings management functions
function loadSettingsFromLocalStorage() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    const settings = extension_settings[extensionName];

    $('#translation_prompt').val(settings.prompt || 'Translate the following English text to Korean:');
    $('#model_select').val(settings.model || 'openai');
    $('#submodel_select').val(settings.submodel || 'gpt-3.5-turbo');
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
            <div class="translate-button fa-solid fa-globe"
                 data-message-id="${messageId}"
                 style="cursor: pointer; margin-right: 5px;"
                 title="Translate">
            </div>
            <div class="toggle-original-button fa-solid fa-eye-slash"
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
    const selectedSubModel = settings.submodel || "gpt-3.5-turbo";
    const translationPrompt = settings.prompt || "Translate the following English text to Korean:";

    let apiEndpoint;
    let requestBody;

    switch(selectedCompany) {
        case 'openai':
            apiEndpoint = '/api/openai/chat/completions';
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
            apiEndpoint = '/api/claude/chat';
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

// Modified button event binding with icon support and stop functionality
function bindButtonEvents(messageId) {

    $(document).off('click', `.translate-button[data-message-id="${messageId}"]`)
        .on('click', `.translate-button[data-message-id="${messageId}"]`, async function() {
            const $button = $(this);

            if ($button.hasClass('fa-spin')) {
                // Stop translation if already running
                console.warn("Translation already running, stopping.");
                return;
            }

            const messageElement = $(`#chat .mes[mesid="${messageId}"]`);
            const messageText = messageElement.find('.mes_text').text().trim();

            // Store original text
            messageElement.attr('data-original-text', messageText);

            // Show loading state and start translation
            $button.addClass('fa-spin');

            // Check if saved translation exists and avoid duplicate calls
            let translatedText = loadTranslationFromFile(messageId);

            if (!translatedText) {
                translatedText = await requestTranslationFromAPI(messageText);

                if (translatedText) {
                    saveTranslationToFile(messageId, translatedText); // Save to file for future use
                }
            }

            if (translatedText) {
                messageElement.find('.mes_text').text(translatedText); // Display translated text
                messageElement.find('.toggle-original-button').show(); // Show the button to toggle back to original
                $button.hide(); // Hide translate button after successful translation
            }

            // Reset loading state
            $button.removeClass('fa-spin');
        });

     $(document).off('click', `.toggle-original-button[data-message-id="${messageId}"]`)
         .on('click', `.toggle-original-button[data-message-id="${messageId}"]`, function() {
             const messageElement = $(`#chat .mes[mesid="${messageId}"]`);
             const originalText = messageElement.attr('data-original-text');
             const currentText = messageElement.find('.mes_text').text();

             if (currentText !== originalText) {
                 // Switch back to original text
                 messageElement.find('.mes_text').text(originalText);
                 $(this).attr('title', 'Show Translation');
                 messageElement.find('.translate-button').show();
                 $(this).hide();
             }
         });
}

// Add event listeners for new messages and swipes
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

// File System Operations for saving and loading translations

// Save translations to file
function saveTranslationToFile(messageId, text) {
    const filePath = `${translationFolderPath}/translations.txt`;

    fs.appendFile(filePath, `Message ID ${messageId}: ${text}\n`, function (err) {
        if (err) throw err;
        console.log(`Message ID ${messageId} translation saved!`);
    });
}

// Load translations from file
function loadTranslationFromFile(messageId) {
    const filePath = `${translationFolderPath}/translations.txt`;

   try {
       const data = fs.readFileSync(filePath, 'utf8');
       const regex = new RegExp(`Message ID ${messageId}: (.+)`);
       const match = data.match(regex);

       return match ? match[1] : null;
   } catch (err) {
       console.error(err);
       return null;
   }
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
