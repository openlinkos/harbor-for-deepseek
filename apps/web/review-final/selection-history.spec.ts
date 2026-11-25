import {test,expect} from '../review-e2e/fixture.js'
import {installMedia,unlock,asrPosts,messagePosts} from '../review-e2e/helpers.js'
const cases=[
 {name:'F01 observed suffix X then repeated prepend must preserve both unselected copies',initial:'abcabc',start:0,end:3,first:['Control+End','X'],second:['Control+Home','abc'],expected:'abc转写结果abcX'},
 {name:'F02 remove selected copy then restore same whole string must not overwrite surviving copy',initial:'abcabc',start:0,end:3,first:['Backspace'],second:['Control+End','abc'],expected:'转写结果abcabc'},
 {name:'F03 single observed suffix edit control',initial:'abcabc',start:0,end:3,first:['Control+End','X'],second:[],expected:'转写结果abcX'},
 {name:'F04 two distinct observed boundary edits control',initial:'123456',start:2,end:4,first:['Control+End','B'],second:['Control+Home','A'],expected:'A12转写结果56B'}
]
for(const c of cases)test(c.name,async({page},info)=>{
 await installMedia(page,'hold');await page.addInitScript(()=>{const O=window.AudioContext;window.AudioContext=class extends O{createScriptProcessor(...a:any[]){const p=super.createScriptProcessor(...a as [number,number,number]);p.addEventListener('audioprocess',()=>{(window as any).__callbacks=((window as any).__callbacks??0)+1});return p}} as typeof AudioContext})
 const session=await unlock(page,{holdAsr:true});const composer=page.getByTestId('composer');await composer.fill(c.initial);await composer.evaluate((node,r)=>{const t=node as HTMLTextAreaElement;t.focus();t.setSelectionRange(r.start,r.end)},c)
 await page.getByTestId('voice-input').click();await expect.poll(()=>page.evaluate(()=>(window as any).__micWaits??0)).toBe(1)
 const edit=async(steps:string[])=>{await composer.focus();for(const s of steps){if(s==='Backspace'||s.startsWith('Control+'))await composer.press(s);else await composer.pressSequentially(s)}}
 await edit(c.first);await page.evaluate(()=>(window as any).__releaseMic());await expect.poll(()=>page.evaluate(()=>(window as any).__callbacks??0),{timeout:10000}).toBeGreaterThan(0)
 await page.getByTestId('voice-input').click();await expect.poll(()=>asrPosts(session.seen).length).toBe(1);await edit(c.second)
 const before=await composer.inputValue();await composer.evaluate(node=>(node as HTMLTextAreaElement).blur());session.releaseAsr();await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label','语音输入')
 const after=await composer.inputValue();await info.attach('selection-edit-history',{body:JSON.stringify({case:c,before,after,messages:messagePosts(session.seen).length}),contentType:'application/json'});expect(messagePosts(session.seen)).toHaveLength(0)
 const payload=asrPosts(session.seen)[0]!.bytes;const wav=payload.subarray(payload.indexOf(Buffer.from('RIFF')));expect(wav.readUInt16LE(20)).toBe(1);expect(wav.readUInt16LE(22)).toBe(1);expect(wav.readUInt32LE(24)).toBe(16000);expect(wav.readUInt16LE(34)).toBe(16);expect(wav.readUInt32LE(40)).toBeGreaterThan(0)
 expect(after).toBe(c.expected)
})
