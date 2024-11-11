// index.js

import { extension_settings, getContext } from "../../../extensions.js";
import { updateMessageBlock, saveSettingsDebounced } from "../../../../script.js"; // script 내장 함수 사용

// 기본 설정값 및 경로 지정
const extensionName = "llm-translator";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const translationFolderPath = './data/translations';

// 번역본 저장 및 불러오기 함수들 정의 (localStorage 또는 파일로 처리)
function getTranslationFilePath(roomId) {
return `${translationFolderPath}/chat_${roomId}_translations.txt`;
}

function loadSwipeTranslationFromFile(roomId, messageId, swipeIndex) {
const filePath = getTranslationFilePath(roomId);

try {
const translations = JSON.parse(localStorage.getItem(filePath)) || []; // localStorage 이용하여 데이터 저장
let translationFound = false;

for (const line of translations) {
if (line.startsWith(`[Message ID:${messageId}]`)) translationFound = true;

if (translationFound && line.startsWith(`Swipe Index:${swipeIndex}`)) {
return line.replace(`Swipe Index:${swipeIndex} ->`, '').trim();
}
}
} catch (err) {
console.error("No translation data found:", err.message);
}

return null;
}

function saveSwipeTranslationToFile(roomId, messageId, swipeIndex, translatedText) {
const filePath = getTranslationFilePath(roomId);

try {
let existingTranslations = JSON.parse(localStorage.getItem(filePath)) || [];
const newLine = `[Message ID:${messageId}]\nSwipe Index:${swipeIndex} -> ${translatedText}\n`;

existingTranslations.push(newLine);
localStorage.setItem(filePath, JSON.stringify(existingTranslations));

} catch (err) {
console.error("Failed to write translation data:", err.message);
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
throw new Error('Unknown model');
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

// 번역 버튼 클릭 시 실행되는 이벤트 리스너
function bindButtonEvents(messageId) {

$(document).off('click', `.translate-button[data-message-id="${messageId}"]`)
.on('click', `.translate-button[data-message-id="${messageId}"]`, () => regenerateSwipeTranslation(messageId));$(document).off('click', `.toggle-original-button[data-message-id="${messageId}"]`)
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
