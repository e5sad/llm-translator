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

// 로컬스토리지에 설정값 저장 함수
function saveSettingsToLocalStorage() {
localStorage.setItem('llm_translator_model', extension_settings.llm_translator.model);
localStorage.setItem('llm_translator_submodel', extension_settings.llm_translator.submodel);
}

// 로컬스토리지에서 설정값 불러오기 함수
function loadSettingsFromLocalStorage() {
const model = localStorage.getItem('llm_translator_model');
const subModel = localStorage.getItem('llm_translator_submodel');

if (model) {
extension_settings.llm_translator.model = model;
$('#model_select').val(model);
}

if (subModel) {
extension_settings.llm_translator.submodel = subModel;
$('#submodel_select').val(subModel);
}
}

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
if (line.startsWith(`[Message ID:${messageId}]`)) translationFound = true;if (translationFound && line.startSwith (`Swipe Index : $ {SwipeIndex}`)) {
 return line.replace (`swipe index : $ {swipeIndex} ->`, '') .trim ();
 }
 }
 } catch (err) {
 Console.error ( "번역 데이터 없음 :", err.message);
 }

 널 리턴;
 }

 함수 SavesWipetRanslationTofile (룸메드, MessageId, SwipeIndex, TranslatedText) {
 const filepath = getTranslationFilePath (룸메이트);

 노력하다 {
 기존 translations = json.parse (localStorage.getItem (filepath)) || [];
 const newline =`[메시지 id : $ {messageid}] \ nswipe index : $ {swipeIndex} -> $ {translatedText} \ n`;

 기존 translations.push (Newline);
 LocalStorage.setItem (FilePath, JSON.Stringify (기존 전송));

 } catch (err) {
 Console.error ( "번역 데이터를 작성하지 못했습니다 :", err.message);
 }
 }

 // api 요청 i 사용하는 사용하는 메인 함수 (회사 및 모델 기반)
 Async 함수 requestTranslationfromapi (텍스트) {

 Apiendpoint를하자;

 const selectedcompany = extension_settings?. [ExtensionName]?. 모델 || "Openai"; // openai
 const selectedSubModel = Extension_Settings?. [ExtensionName]?. 서브 모델 || "GPT-4"; // 기본적으로 gpt4

 if (! selectedCompany ||! selectedSubModel) {
 경고 ( "번역하기 전에 회사와 서브 모델을 선택하십시오.");
 새 오류를 던지십시오 ( '유효하지 않은 모델 또는 서브 모델 선택');
 }

 스위치 (selectedCompany) {
 사례 'openai':
 apiendpoint = '/api/translate/openai'; //이 부분이 필요 (올바른 엔드포인트로 변경할 것 것)
 부서지다;
 사례 'Claude':
 apiendpoint = '/api/translate/claude';
 부서지다;
 케이스 '코어':
 apiendpoint = '/api/translate/cohere';
 부서지다;
 CASE 'Google':
 apiendpoint = '/api/translate/google-ai-studio';
 부서지다;
 기본:
 새로운 오류를 던지십시오 ( '알 수없는 모델');
 }

 console.log (`번역 요청 보내기 $ {selectedCompany}, 모델 : $ {selectedSubModel}`);

 노력하다 {
 const response = 기다려서 페치 (Apiendpoint, {
 방법 : 'post',
 헤더 : getRequestheaders (),
 Body : JSON.Stringify ({text, model : selectedSubModel})
 });

 if (! response.ok) Throw New Error (`모델 $ {selectedCompany}`)를 사용하여 번역하지 못했습니다.

 반환 대기 응답 .text ();

 } catch (오류) {
 Console.error ( "번역 중 오류 :", 오류);
 ALERT (`번역 실패 : $ {ERROR.MESSAGE}`);
 널 리턴;
 }
 }

 // 번역 버튼을 번역 추가하는 함수 함수
 함수 addButtonstomessages () {
 const context = getContext ();
 const 메시지 = context.chat || [];

 if (! messages.length) {
 Console.log ( "메시지 없음");
 반품;
 }

 // 각 메시지마다 각 버튼 추가 추가 (메시지 상단에 사용자 사용자 옆에 옆에 배치)
 messages.foreach ((message, messageId) => {

 // 사용자 이름 사용자 컨테이너에 추가 추가
 if ($ (`#chat .mes [mesid = "$ {messageid}"]`) .find ( '. Translate-Button'). length === 0) {
 const buttonhtml =`
 <div class = "message-buttons">
 <button class = "translate-button"data-message-id = "$ {messageid}"> Translate </button>
 <button class = "Toggle-Original-Button"data-message-id = "$ {messageid}"data-current-state = "translated"> show inriginal </button>
 </div>
 `;;

 // 사용자 이름 사용자 추가하기 (기존 구조를 참고한 위치 위치)
 $ (`#chat .mes [mesid = "$ {messageid}"] .ch_name`) .append (buttonhtml);

 Bindbuttonevents (MessageId); // 이벤트 바인딩
 }
 });
 }

 // 번역 버튼 번역시시 실행되는 이벤트 리스너 연결
 함수 bindbuttonevents (messageId) {

 $ (document) .off ( 'click',`.TransLate-Button [data-message-id = "$ {messageid}"]`)
 .on ( 'click',`.TransLate-Button [data-message-id = "$ {messageid}"]`, async () => {
 const messagetext = $ (`#chat .mes [mesid = "$ {messageid}"] .mes_text`) .text ();
 const translatedText = await requestTranslationFromApi (messagetext);

 if (translatedText! == null) {
 SavesWipetRanslationTofile (getContext (). room_id, MessageId, 0, TranslatedText);
 $ (`#chat .mes [mesid = "$ {messageid}"] .mes_text`) .text (TranslatedText); // 화면에 표시
 }
 });

 $ (document) .off ( 'click',`.toggle-original-button [data-message-id = "$ {messageid}"]`)
 .on ( 'click',`.Toggle-Original-Button [data-message-id = "$ {messageid}"]`, () => toggleoriginalorswipetranslation (messageid));
 }

 // 이벤트 리스너 이벤트 방식 최적화 최적화 : sillytavern 내부에서 발생하는 이벤트 감지 감지
 함수 addeventListeners () {

 eventSource.on (event_types.character_message_rendered, addButtonstomessages); // 캐릭터 메시지가 캐릭터 때 감지 감지
 eventSource.on (event_types.user_message_rendered, addbuttonstomessages); // 사용자 메시지가 사용자 때도 감지 감지

 }

 // 페이지 초기화 페이지 이벤트 리스너 등록하기 등록하기
 jQuery (async () => {

 Console.log ( "LLM Translator 스크립트 초기화!");

 노력하다 {
 새로운 약속을 기다리고 있습니다 (resolve => settimeout (resolve, 900)); // 약간의 지연 약간의 추가

 loadsettingsfromlocalstorage (); // 로컬스토리지에서 설정 로컬스토리지에서const htmlContent = await $.get(`${extensionFolderPath}/example.html`);
$("#extensions_settings").append(htmlContent); // 설정 패널에 HTML 추가

addButtonsToMessages(); // 첫 번째 메시지 그룹에 번역 버튼 추가

addEventListeners(); // 모든 메시지 렌더링 후 이벤트 리스너 연결

} catch (err) {
console.error("Error occurred during LLM Translator initialization:", err);
}
});
