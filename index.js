// Initialize the extension and add buttons to existing and new messages
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

    // Add event listeners for future messages
    addEventListeners();
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
            const errorMessage = await response.text();

            console.error(`API Error (${response.status}): ${errorMessage}`);

            alert(`Translation failed with status ${response.status}.`);

            throw new Error(`API Error (${response.status}): ${errorMessage}`);
        }

        // Safely parse response and check its format
        const contentType = response.headers.get('content-type');

        if (!contentType.includes('application/json')) {
           throw new Error('Unexpected response type from server. Expected application/json.');
       }

       const data = await response.json();
       const translatedText = data.choices?.[0]?.message?.content || data.choices?.[0]?.text;

       if (!translatedText) {
           throw new Error('No translation received from API');
       }

       return translatedText;

   } catch (error) {

       console.error("Translation error:", error.message);
       alert(`Translation failed: ${error.message}`);

       return null;
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
