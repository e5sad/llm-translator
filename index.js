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
}// Translate API 호출 함수 수정: 실제 회사 제공 엔드포인트 사용
async function requestTranslationFromAPI(text) {

let apiEndpoint;

const selectedCompany = extension_settings?.[extensionName]?.model || "openai"; // 기본적으로 OpenAI
const selectedSubModel = extension_settings?.[extensionName]?.submodel || "gpt-4"; // 기본적으로 GPT4

if (!selectedCompany || !selectedSubModel) {
alert("Please select a company and submodel before translating.");
throw new Error('Invalid model or submodel selection.');
}

// API 엔드포인트 정의
switch(selectedCompany) {
case 'openai':
apiEndpoint = 'https://api.openai.com/v1/completions'; // 실제 OpenAI 엔드포인트
break;
case 'claude':
apiEndpoint = 'https://api.anthropic.com/v1/complete'; // Claude 엔드포인트
break;
case 'cohere':
apiEndpoint = 'https://api.cohere.ai/generate'; // Cohere 엔드포인트
break;
case 'google':
apiEndpoint = '/api/translate/google-ai-studio'; // Google Gemini PaLM 엔드포인트 필요 (임시)
break;
default:
throw new Error('Unknown model');
}

console.log(`Sending translation request to ${selectedCompany}, model: ${selectedSubModel}`);

try {
const response = await fetch(apiEndpoint ,{
method: 'POST',
headers: getRequestHeaders(), // 이 부분 해결됨
body: JSON.stringify({ prompt: text, model: selectedSubModel }) // prompt 전달 방식 변경 (회사에 따라 다를 수 있음)
});

if (!response.ok) throw new Error(`Failed to translate using model ${selectedCompany}`);

return await response.json(); // JSON 형태로 응답받음

} catch(error) {
console.error("Error during translation:", error);
alert(`Translation failed: ${error.message}`);
return null;
}
}

// 번역 및 원문보기 버튼을 메시지에 추가하는 함수
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
`;

$(`#chat .mes[mesid="${messageId}"] .ch_name`).append(buttonHtml);

bindButtonEvents(messageId); // 이벤트 바인딩
}
});
}

// 이벤트 리스너 등록 방식 최적화: SillyTavern 내부에서 발생하는 이벤트 감지
function addEventListeners() {

eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, addButtonsToMessages); // 캐릭터 메시지가 렌더링될 때 감지
eventSource.on(event_types.USER_MESSAGE_RENDERED, addButtonsToMessages); // 사용자 메시지가 렌더링될 때도 감지

}

// Drawer 설정 값 유지하기 위한 로컬 스토리지 관리
function loadSettingsFromLocalStorage() {
const savedPrompt = localStorage.getItem(`${extensionName}_prompt`);
const savedModel = localStorage.getItem(`${extensionName}_model`);
const savedSubmodel = localStorage.getItem(`${extensionName}_submodel`);

if (savedPrompt) $('#translation_prompt').val(savedPrompt);
if (savedModel) $('#model_select').val(savedModel).trigger('change'); // 모델 변경 시 트리거 작동시키기 위함
if (savedSubmodel) $('#submodel_select').val(savedSubmodel);
}

// 새로운 설정 값 적용 시 로컬 스토리지에 저장하기
function saveSettingsToLocalStorage() {
const prompt = $('#translation_prompt').val();
const model = $('#model_select').val();
const submodel = $('#submodel_select').val();

localStorage.setItem(`${extensionName}_prompt`, prompt);
localStorage.setItem(`${extensionName}_model`, model);
localStorage.setItem(`${extensionName}_submodel`, submodel);
}

// 페이지 초기화 및 이벤트 리스너 등록하기
jQuery(async () => {

console.log("LLM Translator script initialized!");

try {
await new Promise(resolve => setTimeout(resolve, 900)); // 약간의 지연 시간 추가

const htmlContent = await $.get(`${extensionFolderPath}/example.html`);
$("#extensions_settings").append(htmlContent);

loadSettingsFromLocalStorage(); // 새로고침 후에도 설정 값을 불러오기

addButtonsToMessages();
addEventListeners();

$('#save_settings_button').click(saveSettingsToLocalStorage); // Save and Apply settings 자동 적용

} catch (err) {
console.error("Error occurred during LLM Translator initialization:", err);
}
});
