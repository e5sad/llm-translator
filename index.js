// index.js (최종 수정)

import { extension_settings, getContext } from "../../../extensions.js";
import { updateMessageBlock, saveSettingsDebounced } from "../../../../script.js"; // script 내장 함수 사용

// 기본 설정값 및 경로 지정
const extensionName = "llm-translator";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const translationFolderPath = './data/translations';

// 각 회사에 대한 세부 모델 리스트 정의
const subModelsByCompany = {
openai: ['gpt4', 'gpt3.5'],
claude: ['claude-v1', 'claude-v2'],
cohere: ['command-xlarge', 'command-medium'],
google: ['gemini', 'lamda']
};

// 번역본 저장 및 불러오기 함수들 정의 (localStorage로 처리)
function getTranslationFilePath(roomId) {
return `${translationFolderPath}/chat_${roomId}_translations.txt`;
}

function loadSwipeTranslationFromFile(roomId, messageId, swipeIndex) {
const filePath = getTranslationFilePath(roomId);

try {
const translations = JSON.parse(localStorage.getItem(filePath)) || []; // localStorage 이용하여 데이터 저장
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
case "openai":
apiEndpoint = '/api/translate/openai';
break;
case "claude":
apiEndpoint = '/api/translate/claude';
break;
case "cohere":
apiEndpoint = '/api/translate/cohere';
break;
case "google":
apiEndpoint = '/api/translate/google-ai-studio';
break;
default:
throw new Error("알 수 없는 모델");
}

console.log(`Sending translation request to ${selectedCompany}, model: ${selectedSubModel}`);

// API 호출 시 서브모델 정보도 함께 전달합니다.
const response = await fetch(apiEndpoint ,{
method: 'POST',
headers: getRequestHeaders(),
body: JSON.stringify({ text, model: selectedSubModel }) // 선택된 서브모델 전송
});

if (!response.ok) throw new Error(`Failed to translate using model ${selectedCompany}`);

return await response.text();
}

// 번역 버튼을 메시지에 추가하는 함수
function addButtonsToMessages() {
const context = getContext();
const messages = context.chat || []; // 채팅 메시지 컨텍스트 가져오기

console.log("Attempting to add buttons to messages...");

if (!messages.length) {
console.log("No messages found.");
return;
}

messages.forEach((message, messageId) => {

console.log(`Processing message ${messageId}`);

// 각 메시지에 대해 swipes 데이터 처리 (리롤 데이터 처리)
if (Array.isArray(message.swipes)) {
message.swipes.forEach((_, swipeIndex) => {

console.log(`Processing swipe index ${swipeIndex} for message ${messageId}`);

// 이미 버튼이 추가된 경우 중복으로 추가하지 않음
if (!$(`#chat .mes[mesid="${messageId}"]`).find(`.translate-button[data-swipe-index="${swipeIndex}"]`).length) {

const buttonHtml = `
<button class="translate-button" data-message-id="${messageId}" data-swipe-index="${swipeIndex}">번역</button>
<button class="toggle-original-button" data-message-id="${messageId}" data-swipe-index="${swipeIndex}" data-current-state="translated">원문 보기</button>
`;
$(`#chat .mes[mesid="${messageId}"] .mes_text`).append(buttonHtml);

// 로그 출력
console.log(`Added translate and toggle buttons for message ${messageId}, swipe index ${swipeIndex}`);bindButtonEvents(messageId, swipeIndex); // 버튼 이벤트 연결
}
});
} else {
// 일반적인 메시지 처리
if (!$(`#chat .mes[mesid="${messageId}"]`).find('.translate-button').length) {

const buttonHtml = `
<button class="translate-button" data-message-id="${messageId}">번역</button>
<button class="toggle-original-button" data-message-id="${messageId}" data-current-state="translated">원문 보기</button>
`;
$(`#chat .mes[mesid="${messageId}"] .mes_text`).append(buttonHtml);

// 로그 출력
console.log(`Added translate and toggle buttons for message ${messageId}`);

bindButtonEvents(messageId); // 버튼 이벤트 연결
}
}

});
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
