javascript
import { extension_settings, getContext } from "../../../extensions.js";
import { updateMessageBlock, saveSettingsDebounced } from "../../../../script.js";

const extensionName = "llm-translator";
const translationFolderPath = './data/translations';

// Function to retrieve file path for chat translations
function getTranslationFilePath(roomId) {
    return `${translationFolderPath}/chat_${roomId}_translations.txt`;
}

// Load stored translation from the file based on message ID and swipe index
function loadSwipeTranslationFromFile(roomId, messageId, swipeIndex) {
    const filePath = getTranslationFilePath(roomId);

    try {
        const translations = JSON.parse(localStorage.getItem(filePath)) || [];
        let foundTranslation = false;

        for (const line of translations) {
            if (line.startsWith(`[Message ID:${messageId}]`)) foundTranslation = true;

            if (foundTranslation && line.startsWith(`Swipe ID:${swipeIndex}`)) {
                return line.replace(`Swipe ID:${swipeIndex} ->`, '').trim();
            }
        }
    } catch (err) {
        console.error("No translation data found:", err.message);
    }

    return null;
}

// Save new translation into the file
function saveSwipeTranslationToFile(roomId, messageId, swipeIndex, translatedText) {
    const filePath = getTranslationFilePath(roomId);

    try {
        let existingTranslations = JSON.parse(localStorage.getItem(filePath)) || [];
        const newLine = `[Message ID:${messageId}]\nSwipe ID:${swipeIndex} -> ${translatedText}\n`;

        existingTranslations.push(newLine);
        localStorage.setItem(filePath, JSON.stringify(existingTranslations));

    } catch (err) {
        console.error("Failed to write translation data:", err.message);
    }
}

// API request based on selected provider and model
async function requestTranslationFromAPI(text) {

   let apiEndpoint;

   const selectedProvider = extension_settings[extensionName].model;
   const selectedSubModel = extension_settings[extensionName].submodel;

   switch(selectedProvider) {
       case 'openai':
           apiEndpoint = '/api/translate/openai';
           break;
       case 'claude':
           apiEndpoint = '/api/translate/claude';
           break;
       case 'cohere':
           apiEndpoint = '/api/translate/cohere';
           break;
       case 'google':
           apiEndpoint = '/api/translate/google-ai-studio';
           break;
       default:
           throw new Error('Unknown model');
   }

   console.log(`Sending translation request to ${selectedProvider}, model: ${selectedSubModel}`);

   const response = await fetch(apiEndpoint ,{
       method: 'POST',
       headers: getRequestHeaders(),
       body: JSON.stringify({ text, model: selectedSubModel })
   });

   if (!response.ok) throw new Error(`Failed to translate using model ${selectedProvider}`);

   return await response.text();
}

// Add buttons next to each chat message for translation
function addButtonsToMessages() {
    const context = getContext();
    const messages = context.chat || [];

    if (!messages.length) return;

    messages.forEach((message, messageId) => {

       if ($(`#chat .mes[mesid="${messageId}"]`).find('.translate-button').length === 0) {

           const buttonHtml = `
               <button class="translate-button" data-message-id="${messageId}">Translate</button>
               <button class="toggle-original-button" data-message-id="${messageId}" data-current-state="translated">Show Original</button>
           `;
           $(`#chat .mes[mesid="${messageId}"] .mes_text`).append(buttonHtml);

           bindButtonEvents(messageId);
       }
   });
}

// Event listener binding for translation and retranslation buttons
function bindButtonEvents(messageId) {

   $(document).off('click', `.translate-button[data-message-id="${messageId}"]`)
               .on('click', `.translate-button[data-message-id="${messageId}"]`, () => regenerateSwipeTranslation(messageId));

   $(document).off('click', `.toggle-original-button[data-message-id="${messageId}"]`)
               .on('click', `.toggle-original-button[data-message-id="${messageId}"]`, () => toggleOriginalOrSwipeTranslation(messageId));
}

// Initialize the page and setup event listeners
jQuery(async () => {

   try {
       await new Promise(resolve => setTimeout(resolve, 900));

       const htmlContent = await $.get(`${extensionFolderPath}/example.html`);
       $("#extensions_settings").append(htmlContent);

       addButtonsToMessages();

       eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, addButtonsToMessages);

   } catch (err) {
       console.error("Error during LLM Translator initialization:", err);
   }
});
