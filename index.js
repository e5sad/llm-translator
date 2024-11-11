// index.js

import {
extension_settings,
getContext,
} from "../../../extensions.js";
import { updateMessageBlock, saveSettingsDebounced, getRequestHeaders } from "../../../../script.js"; // getRequestHeaders 추가됨
import { eventSource, event_types } from "../../../../script.js"; // event_types 가져오기

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
const translations = JSON.parse(localStorage.getItem(filePath)) || [];
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

const selectedCompany = extension_settings?.[extensionName]?.model || "openai"; // 기본적으로 OpenAI
const selectedSubModel = extension_settings?.[extensionName]?.submodel || "gpt-4"; // 기본적으로 GPT4

if (!selectedCompany || !selectedSubModel) {
alert("Please select a company and submodel before translating.");
throw new Error('Invalid model or submodel selection.');
}

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

try {
const response = await fetch(apiEndpoint ,{
method: 'POST',
headers: getRequestHeaders(), // 이 부분 해결됨
body: JSON.stringify({ text, model: selectedSubModel })
});

if (!response.ok) throw new Error(`Failed to translate using model ${selectedCompany}`);

return await response.text();

} catch(error) {
console.error("Error during translation:", error);
alert(`Translation failed: ${error.message}`);
return null;
}
}

// 번역 버튼을 메시지에 추가하는 함수
function addButtonsToMessages() {
const context = getContext();
const messages = context.chat || [];

if (!messages.length) {
console.log("No messages found.");
return;
}

// 각 메시지마다 번역 버튼 추가 (메시지 상단에 사용자 이름 옆에 배치)
messages.forEach((message, messageId) => {

// 사용자 이름 옆 컨테이너에 추가
if ($(`#chat .mes[mesid="${messageId}"]`).find('.translate-button').length === 0) {
const buttonHtml = `
<div class="message-buttons">
<button class="translate-button" data-message-id="${messageId}">Translate</button>
<button class="toggle-original-button" data-message-id="${messageId}" data-current-state="translated">Show Original</button>
</div>
`;// 사용자 이름 옆에 추가하기 (기존 구조를 참고한 위치)
$(`#chat .mes[mesid="${messageId}"] .ch_name`).append(buttonHtml);

bindButtonEvents(messageId); // 이벤트 바인딩
}
});
}

// 번역 버튼 클릭 시 실행되는 이벤트 리스너 연결
function bindButtonEvents(messageId) {

$(document).off('click', `.translate-button[data-message-id="${messageId}"]`)
.on('click', `.translate-button[data-message-id="${messageId}"]`, async () => {
const messageText = $(`#chat .mes[mesid="${messageId}"] .mes_text`).text();
const translatedText = await requestTranslationFromAPI(messageText);

if (translatedText !== null) {
saveSwipeTranslationToFile(getContext().room_id, messageId, 0, translatedText);
$(`#chat .mes[mesid="${messageId}"] .mes_text`).text(translatedText); // 화면에 표시
}
});

$(document).off('click', `.toggle-original-button[data-message-id="${messageId}"]`)
.on('click', `.toggle-original-button[data-message-id="${messageId}"]`, () => toggleOriginalOrSwipeTranslation(messageId));
}

// 이벤트 리스너 등록 방식 최적화: SillyTavern 내부에서 발생하는 이벤트 감지
function addEventListeners() {

eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, addButtonsToMessages); // 캐릭터 메시지가 렌더링될 때 감지
eventSource.on(event_types.USER_MESSAGE_RENDERED, addButtonsToMessages); // 사용자 메시지가 렌더링될 때도 감지

}

// 페이지 초기화 및 이벤트 리스너 등록하기
jQuery(async () => {

console.log("LLM Translator script initialized!");

try {
await new Promise(resolve => setTimeout(resolve, 900)); // 약간의 지연 시간 추가

const htmlContent = await $.get(`${extensionFolderPath}/example.html`);
$("#extensions_settings").append(htmlContent); // 설정 패널에 HTML 추가

addButtonsToMessages(); // 첫 번째 메시지 그룹에 번역 버튼 추가

addEventListeners(); // 모든 메시지 렌더링 후 이벤트 리스너 연결

} catch (err) {
console.error("Error occurred during LLM Translator initialization:", err);
}
});
