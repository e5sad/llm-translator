// index.js

// public/scripts 내 secret.js 파일과 util.js 파일을 직접 참조하는 대신,
// 이미 시스템 내부에서 제공하는 모듈들만 사용하고 있습니다.

// 실리태번 전용 함수들 (필요시 import 처리)
import { extension_settings, getContext } from "../../../extensions.js";
import { updateMessageBlock, saveSettingsDebounced } from "../../../../script.js"; // script 내장 함수 사용

// secret.js 관련 함수는 이미 fetch 메서드를 통해 비동기적으로 처리 가능함
import { findSecret } from '../../../../public/scripts/secrets.js'; // secrets.js 로드 (유효한 경로 확인)

// 상대 경로로 util.js 처리를 하지 않음 (필요한 경우 기존 유틸리티 대체)

const extensionName = "llm-translator";
const translationFolderPath = './data/translations';

// 각 회사에 대한 세부 모델 리스트 정의
const subModelsByCompany = {
openai: ['gpt4', 'gpt3.5'],
claude: ['claude-v1', 'claude-v2'],
cohere: ['command-xlarge', 'command-medium'],
google: ['gemini', 'lamda']
};

// 번역본 저장 및 불러오기 함수들 정의
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

// 번역본을 localStorage에 저장하는 함수
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

// API 요청 시 사용하는 메인 함수 (회사 및 모델을 기반으로)
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
body: JSON.stringify({
text,
model: selectedSubModel // 여기서 선택된 서브모델 전송
})
});

if (!response.ok) throw new Error(`Failed to translate using model ${selectedCompany}`);

return await response.text();
}

// 페이지 초기화 및 이벤트 리스너 등록하기
jQuery(async () => {

console.log("LLM Translator script initialized!");try {
// example.html 로드하고 특정 DOM 영역에 추가하기
const htmlContent = await $.get(`${extensionFolderPath}/example.html`);
console.log("HTML content loaded successfully.");

// 설정 패널 부분에 HTML 삽입 (SillyTavern의 설정 창에 넣음)
$("#extensions_settings").append(htmlContent);
console.log("Appended HTML content to extensions settings.");

addButtonsToMessages(); // 메세지 처리 후 버튼 추가

eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, addButtonsToMessages); // 메시지가 렌더링될 때마다 번역 버튼 추가

} catch (err) {
console.error("Error occurred during LLM Translator initialization:", err);
}
});
