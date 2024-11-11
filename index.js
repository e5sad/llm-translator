// index.js

import { extension_settings, getContext } from "../../../extensions.js";
import { updateMessageBlock, saveSettingsDebounced } from "../../../../script.js"; // script 내장 함수 사용

// 기본 설정값 및 경로 지정
const extensionName = "llm-translator";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const translationFolderPath = './data/translations';

const subModelsByCompany = {
openai: [
"gpt-3.5-turbo-0125",
"gpt-3.5-turbo-1106",
"gpt-3.5-turbo-0613",
"gpt-3.5-turbo-0301",
"gpt-3.5-turbo-16k",
"gpt-3.5-turbo-16k-0613",
"gpt-3.5-turbo-instruct-0914",
"gpt-4-0314",
"gpt-4-0613",
"gpt-4-32k",
"gpt-4-1106-preview",
"gpt-4-0125-preview", 
"gpt-4-turbo-2024-04-09",
"gpt-4o-2024-05-13",
"gpt-4o-2024-08-06",
"gpt-4o-mini-2024-07-18",
"chatgpt-4o-latest",
"o1-preview",
"o1-mini"
],

claude: [
"claude-3-5-sonnet-latest",
"claude-3-5-sonnet-20241022",
"claude-3-5-sonnet-20240620",
"claude-3-opus-20240229",
"claude-3-sonnet-20240229",
"claude-3-haiku-20240307",
"claude-instant-1.2",
"claude-instant-1.1",
"claude-v2.1",
"claude-v2.0",
"claude-v1.3"
],

cohere: [
"command-light",
"command",
"command-r",
"command-r-plus",
"command-r-08-2024",
"command-r-plus-08-2024",
"command-light-nightly",
"command-nightly"
],

google : [
// Google Gemini 및 PaLM 모델들 정확히 추가
"gemini-1.5-pro-exp-0801",
"gemini-1.5-pro-exp-0827",
"gemini-1.5-pro-latest",
"gemini-1.5-pro-001",
"gemini-1.5-pro-002", 
"gemini-1.5-flash-8b",
"gemini-1.5-flash-exp-0827",
"gemini-1.5-flash-8b-exp-0827",
"gemini-1.5-flash-8b-exp-0924",
"gemini-1.5-flash-latest",
"gemini-1.5-flash-001",
"gemini-1.5-flash-002",
"gemini-1.0-pro-latest",
"gemini-1.0-pro-001",
"gemini-1.0-pro-vision-latest"
]
};

// 번역본 저장 및 불러오기 함수들 정의 (localStorage로 처리)
function getTranslationFilePath(roomId) {
return `${translationFolderPath}/chat_${roomId}_translations.txt`;
}

function loadSwipeTranslationFromFile(roomId, messageId, swipeIndex) {
const filePath = getTranslationFilePath(roomId);

try {
const translations = JSON.parse(localStorage.getItem(filePath)) || [];
let translationFound = false;

for (const line of translations) {
if (line.startsWith(`[메시지 번호:${messageId}]`)) translationFound = true;

if (translationFound && line.startsWith(`리롤 번호:${swipeIndex}`)) {
return line.replace(`리롤 번호:${swipeIndex} ->`, '').trim();
}
}
} catch (err) {
console.error("번역 데이터 없음:", err.message);
}

return null;
}

function saveSwipeTranslationToFile(roomId, messageId, swipeIndex, translatedText) {
const filePath = getTranslationFilePath(roomId);

try {
let existingTranslations = JSON.parse(localStorage.getItem(filePath)) || [];
const newLine = `[메시지 번호:${messageId}]\n리롤 번호:${swipeIndex} -> ${translatedText}\n`;

existingTranslations.push(newLine);
localStorage.setItem(filePath, JSON.stringify(existingTranslations));

} catch (err) {
console.error("번역 데이터 쓰기 실패:", err.message);
}
}

// API 요청 시 사용하는 메인 함수 (회사 및 모델 기반)
async function requestTranslationFromAPI(text) {

let apiEndpoint;

const selectedCompany = extension_settings[extensionName].model;
const selectedSubModel = extension_settings[extensionName].submodel;

switch(selectedCompany) {
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
throw new Error('알 수 없는 모델');
}

console.log(`Sending translation request to ${selectedCompany}, model: ${selectedSubModel}`);

const response = await fetch(apiEndpoint ,{
method: 'POST',
headers: getRequestHeaders(),
body: JSON.stringify({ text, model: selectedSubModel })
});

if (!response.ok) throw new Error(`Failed to translate using model ${selectedCompany}`);

return await response.text();
}

// 번역 버튼을 메시지에 추가하는 함수
function addButtonsToMessages() {
const context = getContext();
const messages = context.chat || [];

if (!messages.length) {
console.log("No messages found.");
return;
}

// 각 메시지마다 번역 버튼 추가
messages.forEach((message, messageId) => {

if ($(`#chat .mes[mesid="${messageId}"]`).find('.translate-button').length === 0) {const buttonHtml = `
<button class="translate-button" data-message-id="${messageId}">번역</button>
<button class="toggle-original-button" data-message-id="${messageId}" data-current-state="translated">원문 보기</button>
`;
$(`#chat .mes[mesid="${messageId}"] .mes_text`).append(buttonHtml);

bindButtonEvents(messageId);
}
});
}

// 번역 버튼 클릭 시 실행되는 이벤트 리스너
function bindButtonEvents(messageId) {

$(document).off('click', `.translate-button[data-message-id="${messageId}"]`)
.on('click', `.translate-button[data-message-id="${messageId}"]`, () => regenerateSwipeTranslation(messageId));

$(document).off('click', `.toggle-original-button[data-message-id="${messageId}"]`)
.on('click', `.toggle-original-button[data-message-id="${messageId}"]`, () => toggleOriginalOrSwipeTranslation(messageId));
}

// 페이지 초기화 및 이벤트 리스너 등록하기
jQuery(async () => {

console.log("LLM Translator script initialized!");

try {
await new Promise(resolve => setTimeout(resolve, 900)); // 약간의 지연 시간 추가

const htmlContent = await $.get(`${extensionFolderPath}/example.html`);

$("#extensions_settings").append(htmlContent); // 설정 패널에 HTML 추가

addButtonsToMessages(); // 번역 버튼 추가

eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, addButtonsToMessages);

} catch (err) {
console.error("Error occurred during LLM Translator initialization:", err);
}
});
