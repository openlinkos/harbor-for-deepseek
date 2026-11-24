import {test,expect} from '../review-network'
import {installMedia,unlock,asrPosts,messagePosts} from '../review-e2e/helpers.js'
const initial='L TARGET R'
const arm=async(page:any,withChat=false)=>{
 await installMedia(page,'hold');await page.addInitScript(()=>{const O=window.AudioContext;window.AudioContext=class extends O{createScriptProcessor(...a:any[]){const p=super.createScriptProcessor(...a as [number,number,number]);p.addEventListener('audioprocess',()=>{(window as any).__reviewCallbacks=((window as any).__reviewCallbacks??0)+1});return p}} as typeof AudioContext})
 const session=await unlock(page,{holdAsr:true});if(withChat){await page.getByTestId('composer').fill('existingchat');await page.getByTestId('send').click();await expect(page.getByTestId('assistant-text')).toContainText('合成回答。')}
 const box=page.getByTestId('composer');await box.fill(initial);await box.evaluate((n:any)=>{n.focus();n.setSelectionRange(2,8)});await page.getByTestId('voice-input').click();await expect.poll(()=>page.evaluate(()=>(window as any).__micWaits??0)).toBe(1);await page.evaluate(()=>(window as any).__releaseMic());await expect.poll(()=>page.evaluate(()=>(window as any).__reviewCallbacks??0),{timeout:10000}).toBeGreaterThan(0);await page.getByTestId('voice-input').click();await expect.poll(()=>asrPosts(session.seen).length).toBe(1);return {box,session}
}
for(const armed of [false,true]) test(armed?'R02 retyped same literal undo must not revive old authorization':'R01 native control retyped same literal undo',async({page},info)=>{
 let box:any,session:any
 if(armed)({box,session}=await arm(page));else{await installMedia(page,'deny');session=await unlock(page);box=page.getByTestId('composer');await box.fill(initial)}
 await box.focus();await box.press('Control+a');await box.pressSequentially('NEW-DRAFT');await box.press('Control+a');await box.pressSequentially(initial);await box.press('Control+End');await box.pressSequentially('X');const before=await box.inputValue();await box.press('Control+z');const undo=await box.inputValue();if(armed){session.releaseAsr();await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label','语音输入')};const delivered=await box.inputValue();await info.attach('residual-history-actual',{body:JSON.stringify({armed,before,undo,delivered,messages:messagePosts(session.seen).length}),contentType:'application/json'});expect(before).toBe(initial+'X');expect(undo).toBe(initial);expect(delivered).toBe(initial);if(armed)await expect(page.getByTestId('voice-recovery')).toBeVisible()
})
