// index.js

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

console.log(`Sending translation request to ${selectedCompany}, model: ${selectedSubModel}`);// API 호출 시 서브모델 정보도 함께 전달합니다.
const response = await fetch(apiEndpoint ,{
method: 'POST',
headers: getRequestHeaders(),
body: JSON.stringify({ text, model: selectedSubModel }) // 선택된 서브모델 전송
});

if (!response.ok) throw new Error(`Failed to translate using model ${selectedCompany}`);

return await response.text();
}

// 페이지 초기화 및 이벤트 리스너 등록하기
jQuery(async () => {

console.log("LLM Translator script initialized!");

try {
// SetTimeout으로 약간의 지연 시간 추가 (충돌 방지)
await new Promise(resolve => setTimeout(resolve, 900));

// example.html 로드하고 SillyTavern 설정 패널에 삽입
const htmlContent = await $.get(`${extensionFolderPath}/example.html`);

$("#extensions_settings").append(htmlContent); // 설정 패널에 HTML 추가
console.log("Appended HTML content to extensions settings.");

addButtonsToMessages(); // 번역 버튼 추가

eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, addButtonsToMessages); // 메시지가 렌더링될 때마다 버튼 처리

} catch (err) {
console.error("Error occurred during LLM Translator initialization:", err);
}
});
