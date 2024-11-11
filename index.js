 자바 스크립트
 "../../../extensions.js"에서 {extension_settings, getContext} import;
 "../../../../script.js"에서 import {updateMessageBlock, SaveSettingSdeBounced};

 const extensionname = "llm-translator";
 const translationfolderpath = './data/translations';

 // 채팅 번역의 파일 경로를 검색하는 기능
 함수 getTranslationFilePath (roomid) {
 `$ {translationfolderpath}/채팅 _ $ {roomid} _translations.txt`;
 }

 // 메시지 ID 및 스 와이프 인덱스를 기반으로 파일에서 저장된 변환로드
 함수로드 위시 트랜SlationFromFile (RoomId, MessageId, SwipeIndex) {
 const filepath = getTranslationFilePath (룸메이트);

 노력하다 {
 const translations = json.parse (localStorage.getItem (filepath)) || [];
 FoundTranslation = false;

 for (const line of Translations) {
 if (line.startSwith (`[message id : $ {messageid}]`)) foundTranslation = true;

 if (foundTranslation && line.startSwith (`swipe id : $ {swipeIndex}`)) {
 return line.replace (`swipe id : $ {swipeIndex} ->`, '') .trim ();
 }
 }
 } catch (err) {
 Console.error ( "번역 데이터 없음 :", err.message);
 }

 널 리턴;
 }

 // 파일에 새 번역을 저장합니다
 함수 SavesWipetRanslationTofile (룸메드, MessageId, SwipeIndex, TranslatedText) {
 const filepath = getTranslationFilePath (룸메이트);

 노력하다 {
 기존 translations = json.parse (localStorage.getItem (filepath)) || [];
 const newline =`[message id : $ {messageid}] \ nswipe id : $ {swipeIndex} -> $ {translatedText} \ n`;

 기존 translations.push (Newline);
 LocalStorage.setItem (FilePath, JSON.Stringify (기존 전송));

 } catch (err) {
 Console.error ( "번역 데이터를 작성하지 못했습니다 :", err.message);
 }
 }

 // 선택한 공급자 및 모델을 기반으로 한 API 요청
 Async 함수 requestTranslationfromapi (텍스트) {

 Apiendpoint를하자;

 const selectedProvider = Extension_Settings [ExtensionName] .Model;
 const selectedSubModel = Extension_Settings [ExtensionName] .SubModel;

 스위치 (selectedProvider) {
 사례 'openai':
 apiendpoint = '/api/translate/openai';
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

 console.log (`번역 요청 보내기 $ {selectedProvider}, 모델 : $ {selectedSubmodel}`);

 const response = 기다려서 페치 (Apiendpoint, {
 방법 : 'post',
 헤더 : getRequestheaders (),
 Body : JSON.Stringify ({text, model : selectedSubModel})
 });

 if (! response.ok) Throw New Error (`모델 $ {selectedProvider}`)를 사용하여 번역하지 못했습니다.

 반환 대기 응답 .text ();
 }

 // 번역을 위해 각 채팅 메시지 옆에 버튼 추가
 함수 addButtonstomessages () {
 const context = getContext ();
 const 메시지 = context.chat || [];

 if (! messages.length) 반환;

 messages.foreach ((message, messageId) => {

 if ($ (`#chat .mes [mesid = "$ {messageid}"]`) .find ( '. Translate-Button'). length === 0) {

 const buttonhtml =`
 <button class = "translate-button"data-message-id = "$ {messageid}"> Translate </button>
 <button class = "Toggle-Original-Button"data-message-id = "$ {messageid}"data-current-state = "translated"> show inriginal </button>
 `;;
 $ (`#chat .mes [mesid = "$ {messageid}"] .mes_text`) .append (buttonhtml);

 Bindbuttonevents (MessageId);
 }
 });
 }

 // 번역 및 재고 버튼에 대한 이벤트 리스너 바인딩
 함수 bindbuttonevents (messageId) {

 $ (document) .off ( 'click',`.TransLate-Button [data-message-id = "$ {messageid}"]`)
 .on ( 'click',`.TransLate-Button [data-message-id = "$ {messageid}"]`, () => regeneratesWipetRanslation (messageId));

 $ (document) .off ( 'click',`.toggle-original-button [data-message-id = "$ {messageid}"]`)
 .on ( 'click',`.Toggle-Original-Button [data-message-id = "$ {messageid}"]`, () => toggleoriginalorswipetranslation (messageid));
 }

 // 페이지 초기화 및 설정 이벤트 리스너
 jQuery (async () => {

 노력하다 {
 새로운 약속을 기다리고 있습니다 (resolve => settimeout (resolve, 900));

 const htmlcontent = await $ .get (`$ {ExtensionfolderPath}/example.html`);
 $ ( "#extensions_settings"). Append (htmlContent);

 AddButtonStomessages ();

 eventSource.on (event_types.character_message_rendered, addButtonstomessages);} catch (err) {
console.error("Error during LLM Translator initialization:", err);
}
});
