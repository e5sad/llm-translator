async function requestTranslationFromAPI(text) {
    if (!text?.trim()) return null;

    const settings = extension_settings[extensionName] || {};
    const selectedModel = settings.model || 'openai';
    const selectedSubModel = settings.submodel || 'gpt-3.5-turbo';
    const prompt = settings.prompt || '다음 영어 텍스트를 한글로 번역하시오:';

    let apiEndpoint, headers, body;

    switch(selectedModel) {
        case 'openai':
            apiEndpoint = 'https://api.openai.com/v1/chat/completions';
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.openai_key}`, // OpenAI API 키 필요
            };
            body = {
                model: selectedSubModel,
                messages: [
                    { role: "system", content: prompt },
                    { role: "user", content: text }
                ]
            };
            break;

        case 'claude':
            apiEndpoint = 'https://api.anthropic.com/v1/messages';
            headers = {
                'Content-Type': 'application/json',
                'x-api-key': settings.claude_key, // Claude API 키 필요
                'anthropic-version': '2023-06-01'
            };
            body = {
                model: selectedSubModel,
                messages: [
                    { role: "user", content: `${prompt}\n\n${text}` }
                ]
            };
            break;

        case 'google':
            apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText';
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.google_key}` // Google AI API 키 필요
            };
            body = {
                prompt: {
                    text: `${prompt}\n\n${text}`
                }
            };
            break;

        case 'cohere':
            apiEndpoint = 'https://api.cohere.ai/v1/generate';
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.cohere_key}` // Cohere API 키 필요
            };
            body = {
                model: selectedSubModel,
                prompt: `${prompt}\n\n${text}`,
                max_tokens: 1000
            };
            break;

        default:
            throw new Error('지원하지 않는 AI 모델입니다.');
    }

    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`API Error (${response.status}): ${await response.text()}`);
        }

        const data = await response.json();
        
        // 각 AI 서비스별 응답 형식에 맞게 처리
        switch(selectedModel) {
            case 'openai':
                return data.choices[0].message.content;
            case 'claude':
                return data.content[0].text;
            case 'google':
                return data.candidates[0].output;
            case 'cohere':
                return data.generations[0].text;
            default:
                throw new Error('응답 처리 중 오류가 발생했습니다.');
        }

    } catch (error) {
        console.error("Translation error:", error);
        alert(`번역 오류: ${error.message}`);
        throw error;
    }
}
