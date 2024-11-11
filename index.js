import { extension_settings, getContext } from "../../../extensions.js";
import { updateMessageBlock } from "../../../../script.js";
import { writeFileSync, readFileSync } from "../../../../util.js"; // util.js 사용
import { findSecret } from '../../../../public/scripts/secret.js'; // secret 관리 모듈

const extensionName = "llm-translator";
const translationFolderPath = './data/translations';

// 각 번역 회사에 대한 서브모델 리스트 정의
const subModelsByCompany = {
openai: ['gpt4', 'gpt3.5'],
claude: ['claude-v1', 'claude-v2'],
cohere: ['command-xlarge', 'command-medium'],
google: ['gemini', 'lamda']
};

// 특정 방의 텍스트 파일 경로 가져오기
function getTranslationFilePath(roomId) {
return `${translationFolderPath}/chat_${roomId}_translations.txt`;
}

// txt 파일에서 리롤 데이터를 불러오는 함수
function loadSwipeTranslationFromFile(roomId, messageId, swipeIndex) {
const filePath = getTranslationFilePath(roomId);

try {
const translations = readFileSync(filePath).split('\n');
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

// 번역본을 txt 파일에 저장하는 함수
function saveSwipeTranslationToFile(roomId, messageId, swipeIndex, translatedText) {
const filePath = getTranslationFilePath(roomId);

try {
const existingTranslations = readFileSync(filePath);
const newLine = `[메시지 번호:${messageId}]\n리롤 번호:${swipeIndex} -> ${translatedText}\n`;

writeFileSync(filePath, existingTranslations + newLine);
} catch (err) {
console.error("번역 데이터 쓰기 실패:", err.message);
}
}

// 메시지 렌더링 후 버튼 추가 함수
function addButtonsToMessages() {
const context = getContext();
const messages = context.chat;

messages.forEach((message, messageId) => {

if (Array.isArray(message.swipes)) {

message.swipes.forEach((_, swipeIndex) => {

// swipes 데이터마다 각각 버튼 추가
if (!$(`#chat .mes[mesid="${messageId}"]`).find(`.translate-button[data-swipe-index="${swipeIndex}"]`).length) {

// 번역 및 토글 버튼 HTML 삽입
const buttonHtml = `
<button class="translate-button" data-message-id="${messageId}" data-swipe-index="${swipeIndex}">번역</button>
<button class="toggle-original-button" data-message-id="${messageId}" data-swipe-index="${swipeIndex}" data-current-state="translated">원문 보기</button>
`;
$(`#chat .mes[mesid="${messageId}"] .mes_text`).append(buttonHtml);

bindButtonEvents(messageId, swipeIndex);
}
});

} else {
// 일반적인 메시지도 처리
bindButtonEvents(messageId);
}
});
}

// 버튼 이벤트 연결하기
function bindButtonEvents(messageId, swipeIndex) {

$(document).off('click', `.translate-button[data-message-id="${messageId}"][data-swipe-index="${swipeIndex}"]`)
.on('click', `.translate-button[data-message-id="${messageId}"][data-swipe-index="${swipeIndex}"]`, () => regenerateSwipeTranslation(messageId, swipeIndex));

$(document).off('click', `.toggle-original-button[data-message-id="${messageId}"][data-swipe-index="${swipeIndex}"]`)
.on('click', `.toggle-original-button[data-message-id="${messageId}"][data-swipe-index="${swipeIndex}"]`, () => toggleOriginalOrSwipeTranslation(messageId, swipeIndex));
}

// 재번역 실행 함수
async function regenerateSwipeTranslation(messageId, swipeIndex) {
const context = getContext();
const room_id = context.room_id || 'default';

// 현재 선택된 Swipe 가져오기
const selectedSwipe = context.chat[messageId].swipes[swipeIndex];

// 새로운 번역 결과 받기
const newTranslatedText = await requestTranslationFromAPI(selectedSwipe.mes);

// 새로 받은 번역본 저장
saveSwipeTranslationToFile(room_id, messageId, swipeIndex, newTranslatedText);

selectedSwipe.extra.display_text = newTranslatedText;

updateMessageBlock(messageId); // UI 업데이트
}

// 원문과 번역본 간 전환 처리 함수
function toggleOriginalOrSwipeTranslation(messageId, swipeIndex) {

const context = getContext();
const room_id = context.room_id || 'default';

let toggleButtonSelector = `.toggle-original-button[data-message-id="${messageId}"][data-swipe-index="${swipeIndex}"]`;let currentState = $(toggleButtonSelector).data('current-state');

let selectedSwipe = context.chat[messageId].swipes[swipeIndex];

if (currentState === 'translated') {

$(toggleButtonSelector).text('번역 보기');
$(toggleButtonSelector).data('current-state', 'original');
$(`#chat .mes[mesid="${messageId}"] .mes_text`).text(selectedSwipe.mes);

} else {

let translatedText = loadSwipeTranslationFromFile(room_id, messageId, swipeIndex);

if (!translatedText) translatedText = "아직 번역되지 않았습니다.";

$(toggleButtonSelector).text('원문 보기');
$(toggleButtonSelector).data('current-state', 'translated');
$(`#chat .mes[mesid="${messageId}"] .mes_text`).text(translatedText);

}
}

// 설정 로드 및 동적 서브모델 변경 함수들

// 설정 불러오기 함수
async function loadSettings() {
extension_settings[extensionName] = extension_settings[extensionName] || {};

$("#model_select").val(extension_settings[extensionName].model);
updateSubModelOptions(extension_settings[extensionName].model); // 서브모델 업데이트

$("#submodel_select").val(extension_settings[extensionName].submodel);
}

// 회사 선택시 서브모델 목록 갱신 함수
function updateSubModelOptions(company) {
const subModels = subModelsByCompany[company];

$("#submodel_select").empty(); // 서브모델 셀렉트 박스 비우기

subModels.forEach(subModel => {
$("#submodel_select").append(new Option(subModel, subModel));
});

if (extension_settings[extensionName].submodel) {
$("#submodel_select").val(extension_settings[extensionName].submodel);
}
}

// 회사 선택 변경 이벤트 핸들러
$("#model_select").on("change", (event) => {
const selectedCompany = $(event.target).val();

extension_settings[extensionName].model = selectedCompany;

updateSubModelOptions(selectedCompany); // 해당 회사의 서브모델 UI 갱신

saveSettingsDebounced(); // 설정 저장
});

// 서브모델 선택 변경 이벤트 핸들러
$("#submodel_select").on("change", (event) => {
const selectedSubModel = $(event.target).val();

extension_settings[extensionName].submodel = selectedSubModel;

saveSettingsDebounced(); // 설정 저장
});

// API 요청 시 사용하는 메인 함수 (회사 및 모델을 기반으로)
async function requestTranslationFromAPI(text) {

let apiEndpoint;

const selectedCompany = extension_settings['llm-translator'].model;
const selectedSubModel = extension_settings['llm-translator'].submodel;

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

// API 호출 시 서브모델 정보도 함께 전달합니다.
const response = await fetch(apiEndpoint ,{
method: 'POST',
headers: getRequestHeaders(),
body: JSON.stringify({
text,
model: selectedSubModel // 여기서 선택된 서브모델을 전송!
})
});

if (!response.ok) throw new Error(`Failed to translate using model ${selectedCompany}`);

return await response.text();
}

// 페이지 초기화 및 이벤트 리스너 등록하기
jQuery(async () => {

addButtonsToMessages();

eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, addButtonsToMessages);

});