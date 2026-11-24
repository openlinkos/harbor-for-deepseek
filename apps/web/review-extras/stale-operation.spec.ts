import {test,expect} from '../review-e2e/fixture.js'
import {installMedia,unlock} from '../review-e2e/helpers.js'
for(const outcome of ['reject','grant','unsettled'])test('N-app obsolete permission '+outcome+' must not disable cancellation of newer acquired mic',async({page},info)=>{
 await installMedia(page,'tone')
 await page.addInitScript(()=>{
  const O=window.AudioContext;const contexts:AudioContext[]=[];(window as any).__contexts=contexts
  window.AudioContext=class extends O{constructor(...a:any[]){super(...a as []);contexts.push(this)}resume(){if(this.sampleRate===16000)return new Promise<void>(()=>{});return super.resume()}} as typeof AudioContext
  const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);let count=0;(window as any).__streams=[]
  navigator.mediaDevices.getUserMedia=(...a)=>{count++;const request=count;const obtain=()=>original(...a).then(stream=>{(window as any).__streams.push({request,stream});return stream});(window as any).__getMediaCount=count;if(count!==1)return obtain();return new Promise((resolve,reject)=>{(window as any).__settleOld=(mode:string)=>{if(mode==='reject')reject(new DOMException('obsolete request denied late','NotAllowedError'));else obtain().then(resolve,reject)}})}
 })
 await unlock(page);const input=page.getByTestId('voice-input')
 await input.click();await expect.poll(()=>page.evaluate(()=>(window as any).__getMediaCount)).toBe(1)
 await input.click();await input.click();await expect.poll(()=>page.evaluate(()=>(window as any).__contexts.length)).toBe(2)
 if(outcome!=='unsettled')await page.evaluate(o=>(window as any).__settleOld(o),outcome)
 // Flush promise reactions; no product state mutation.
 await page.evaluate(async()=>{for(let i=0;i<20;i++)await Promise.resolve()})
 await input.click();await expect(input).toHaveAttribute('aria-label','语音输入')
 const snapshot=await page.evaluate(()=>({tracks:(window as any).__streams.flatMap((x:any)=>x.stream.getTracks().map((t:MediaStreamTrack)=>({request:x.request,state:t.readyState}))),stops:(window as any).__stoppedTracks??0,contexts:(window as any).__contexts.map((c:AudioContext)=>({rate:c.sampleRate,state:c.state}))}))
 await info.attach('actual-acquired-mic-state-after-cancel',{body:JSON.stringify(snapshot),contentType:'application/json'})
 // The obsolete granted fixture track is stopped too; both contexts for the CURRENT request must close.
 await expect.poll(()=>page.evaluate(()=>(window as any).__contexts.filter((c:AudioContext)=>c.sampleRate===16000&&c.state!=='closed').length),{timeout:1000}).toBe(0)
})

test('N-app actual 120s wall timer frees a stalled synthetic recording without sample callbacks',async({page},info)=>{
 await installMedia(page,'tone')
 await page.addInitScript(()=>{const O=window.AudioContext;const contexts:AudioContext[]=[];(window as any).__contexts=contexts;window.AudioContext=class extends O{constructor(...a:any[]){super(...a as []);contexts.push(this)}createScriptProcessor(...a:any[]){const p=super.createScriptProcessor(...a as [number,number,number]);Object.defineProperty(p,'onaudioprocess',{get:()=>null,set:()=>{}});return p}} as typeof AudioContext})
 await page.clock.install();await unlock(page);await page.getByTestId('voice-input').click();await expect(page.getByTestId('voice-timer')).toBeVisible();await page.clock.fastForward(120_501)
 await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label','语音输入')
 await expect.poll(()=>page.evaluate(()=>(window as any).__stoppedTracks??0)).toBe(1)
 await expect.poll(()=>page.evaluate(()=>(window as any).__contexts.every((c:AudioContext)=>c.state==='closed'))).toBe(true)
 await info.attach('wall-clock-stalled-recorder-cleanup',{body:JSON.stringify(await page.evaluate(()=>({stops:(window as any).__stoppedTracks,states:(window as any).__contexts.map((c:AudioContext)=>c.state)}))),contentType:'application/json'})
})
