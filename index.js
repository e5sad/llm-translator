import {
    extension_settings,
    getContext,
} from "../../../extensions.js";
import { updateMessageBlock, saveSettingsDebounced, getRequestHeaders } from "../../../../script.js";
import { eventSource, event_types } from "../../../../script.js";
const fs = require('fs'); // Node.js 파일 시스템 모듈

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

// Initialize the extension and add buttons to messages
function initializeExtension() {
    console.log("Initializing LLM Translator...");

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

// Add 'Translate' and 'Toggle Original/Translation' buttons to each message
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

// Request translation using the provided text and API settings
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
                    { role: "system", content: translationPrompt },
                    { role: "user", content: text }
                ]
            };
            break;
        case 'claude':
            apiEndpoint = '/api/claude/chat';
            requestBody = {
                model: selectedSubModel,
                messages: [{ role: "user", content: `${translationPrompt}\n\n${text}` }]
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

// Bind events to the translate and toggle buttons
function bindButtonEvents(messageId) {

   // Translate button click event
   $(document).off('click', `.translate-button[data-message-id="${messageId}"]`)
       .on('click', `.translate-button[data-message-id="${messageId}"]`, async function() {

           const $button = $(this);
           if ($button.hasClass('fa-spin')) {
               console.warn("Translation already running, stopping.");
               return;
           }

           const messageElement = $(`#chat .mes[mesid="${messageId}"]`);
           const messageText = messageElement.find('.mes_text').text().trim();

           // Store original text and show loading state
           messageElement.attr('data-original-text', messageText);
           $button.addClass('fa-spin');

           // Check for existing translation first
           let translatedText = loadTranslationFromFile(messageId);

           if (!translatedText) {
               translatedText = await requestTranslationFromAPI(messageText);
               if (translatedText) {
                   saveTranslationToFile(messageId, translatedText); // Save translation result
               }
           }

           if (translatedText) {
               messageElement.find('.mes_text').text(translatedText);
               messageElement.find('.toggle-original-button').show();
               $button.hide();
           }

           $button.removeClass('fa-spin');
       });

   // Toggle back and forth between original and translated text
   $(document).off('click', `.toggle-original-button[data-message-id="${messageId}"]`)
       .on('click', `.toggle-original-button[data-message-id="${messageId}"]`, function() {

           const messageElement = $(`#chat .mes[mesid="${messageId}"]`);
           const originalText = messageElement.attr('data-original-text');
           const currentText = messageElement.find('.mes_text').text();

           if (currentText !== originalText) { // Switch to original text
               messageElement.find('.mes_text').text(originalText);
               $(this).attr('title', 'Show Translation');
               messageElement.find('.translate-button').show();
               $(this).hide();
           } else { // Switch back to translated text
               const translatedText = loadTranslationFromFile(messageId);
               if (translatedText) {
                   messageElement.find('.mes_text').text(translatedText);
                   $(this).attr('title', 'Show Original');
                   messageElement.find('.translate-button').hide();
                   $(this).show();
               }
           }
       });
}

// Function to save translations to file (append mode)
function saveTranslationToFile(messageId, text) {
    const filePath = `${translationFolderPath}/translations.txt`;

    fs.appendFile(filePath, `Message ID ${messageId}: ${text}\n`, function (err) {
        if (err) throw err;
        console.log(`Message ID ${messageId} translation saved!`);
    });
}

// Function to load translations from file by Message ID
function loadTranslationFromFile(messageId) {
    const filePath = `${translationFolderPath}/translations.txt`;

    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const regex = new RegExp(`Message ID ${messageId}: (.+)`); // Find corresponding message ID
        const match = data.match(regex);

        return match ? match[1] : null;
    } catch (err) {
        console.error(err);
        return null;
    }
}

// Remove a specific translation from file when deleting a message or swipe
function removeTranslationFromFile(messageId) {
     const filePath = `${translationFolderPath}/translations.txt`;

     try {
         let data = fs.readFileSync(filePath, 'utf8');
         // Replace targeted line with an empty string
         data = data.replace(new RegExp(`Message ID ${messageId}: .+\n`), '');
         fs.writeFileSync(filePath, data);
         console.log(`Removed Message ID ${messageId} from translations.`);
     } catch (err) {
         console.error(err);
     }
}

// Event listeners for newly sent or received messages
function addEventListeners() {
   eventSource.on(event_types.MESSAGE_SENT, function() { setTimeout(() => addButtonsToMessages(), 100); });
   eventSource.on(event_types.MESSAGE_RECEIVED, function() { setTimeout(() => addButtonsToMessages(), 100); });
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

// Initialize on page load and append UI elements for settings management
jQuery(async () => {

   console.log("LLM Translator script initializing...");

   try {

       await new Promise(resolve => setTimeout(resolve, 900));

       const htmlContent = await $.get(`${extensionFolderPath}/example.html`);
       $("#extensions_settings").append(htmlContent);

       loadSettingsFromLocalStorage(); // Load initial configuration

       initializeExtension(); // Set up buttons and behavior

       addEventListeners(); // Add listener for dynamic messages

       $('#translation_prompt, #model_select, #submodel_select').on('change', saveSettingsToLocalStorage);

   } catch (err) {

       console.error("Error during LLM Translator initialization:", err);

   }
});
