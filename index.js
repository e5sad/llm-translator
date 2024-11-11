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

// Translate API 호출 함수 수정: 실제 회사 제공 엔드포인트 사용
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
apiEndpoint = 'https://api.openai.com/v1/completions';
break;
case 'claude':
apiEndpoint = 'https://api.anthropic.com/v1/complete';
break;
case 'cohere':
apiEndpoint = 'https://api.cohere.ai/generate';
break;
default:
throw new Error('Unknown model');
}

console.log(`Sending translation request to ${selectedCompany}, model: ${selectedSubModel}`);

try {
const response = await fetch(apiEndpoint ,{
method: 'POST',
headers: getRequestHeaders(), // 이 부분에서 API 키를 포함한 헤더를 전달함
body: JSON.stringify({
model: selectedSubModel,
prompt: text,
max_tokens: 100, // 필요에 따라 설정
})
});

if (!response.ok) throw new Error(`Failed to translate using model ${selectedCompany}`);
return await response.json(); // JSON 응답 처리

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
messages.forEach((message, messageId) => {// 사용자 이름 옆 컨테이너에 추가
if ($(`#chat .mes[mesid="${messageId}"]`).find('.translate-button').length === 0) {
const buttonHtml = `
<div class="message-buttons">
<button class="translate-button" data-message-id="${messageId}">Translate</button>
<button class="toggle-original-button" data-message-id="${messageId}" data-current-state="translated">Show Original</button>
</div>
`;

$(`#chat .mes[mesid="${messageId}"] .ch_name`).append(buttonHtml);

bindButtonEvents(messageId); // 이벤트 바인딩 수행
}
});
}

// 초기 로딩 시 기존 메세지에도 버튼이 뜨도록 하기 위한 함수
function initButtonsForPreviousMessages() {
addButtonsToMessages(); // 모든 기존 메시지를 대상으로 번역 및 원문 보기 버튼 추가
}

// 번역 버튼 및 원문 보기 버튼 클릭 시 실행되는 이벤트 리스너 등록
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

// 이벤트 리스너 등록 방식 최적화: SillyTavern 내부에서 발생하는 이벤트 감지 및 연결
function addEventListeners() {

eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, addButtonsToMessages); // 캐릭터 메시지가 렌더링될 때 감지
eventSource.on(event_types.USER_MESSAGE_RENDERED, addButtonsToMessages); // 사용자 메시지가 렌더링될 때 감지

initButtonsForPreviousMessages(); // 페이지 로드 시 기존 메세지도 대상으로 처리
}

// Drawer 설정 값 유지하기 위한 로컬 스토리지 관리 로직 추가
function loadSettingsFromLocalStorage() {
const savedPrompt = localStorage.getItem(`${extensionName}_prompt`);
const savedModel = localStorage.getItem(`${extensionName}_model`);
const savedSubmodel = localStorage.getItem(`${extensionName}_submodel`);

if (savedPrompt) $('#translation_prompt').val(savedPrompt);
if (savedModel) $('#model_select').val(savedModel).trigger('change'); // 모델 변경 시 트리거 작동시키기 위함
if (savedSubmodel) $('#submodel_select').val(savedSubmodel);
}

// 새로운 설정 값 적용 시 로컬 스토리지에 저장하기 위한 함수 추가
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
await new Promise(resolve => setTimeout(resolve, 900));

const htmlContent = await $.get(`${extensionFolderPath}/example.html`);
$("#extensions_settings").append(htmlContent);

loadSettingsFromLocalStorage(); // Drawer 설정값 로드

addEventListeners(); // 모든 이벤트 리스너 등록 및 기존 메세지도 처리

$('#save_settings_button').click(saveSettingsToLocalStorage);

} catch (err) {
console.error("Error occurred during LLM Translator initialization:", err);
}
});
