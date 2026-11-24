import { describe,it,expect } from 'vitest'
import { startRecording, type RecordingHost } from './recorder.js'
import { createVoiceInput } from './voiceSession.js'
import { createReadAloud } from './readAloud.js'
import { consumePcm } from './pcm.js'
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}
const fake=(throwAt='',resume=()=>Promise.resolve())=>{
 const count={tracks:0,close:0,disconnect:0}
 const stream={getTracks:()=>[{stop(){count.tracks++}}]} as unknown as MediaStream
 const node=()=>({connect(){if(throwAt==='connect')throw Error('graph connect failure')},disconnect(){count.disconnect++}})
 const host:RecordingHost={getUserMedia:async()=>stream,createContext:()=>({sampleRate:16000,destination:{} as AudioNode,
 createMediaStreamSource(){if(throwAt==='source')throw Error('graph setup failure');return node()},
 createAnalyser:()=>({...node(),fftSize:0,smoothingTimeConstant:0,frequencyBinCount:16,getFloatFrequencyData(){}}),
 createScriptProcessor:()=>({...node(),onaudioprocess:null}),close(){count.close++},resume})}
 return {host,count}
}
describe('reviewer independent lifecycle counterexamples',()=>{
 for(const at of ['source','connect'])it('R01-'+at+' setup exception must release acquired track/context',async()=>{
  const f=fake(at);await expect(startRecording(()=>{},f.host)).rejects.toThrow();expect(f.count).toMatchObject({tracks:1,close:1})
 })
 it('R02 cancelling pending resume must not retain an acquired microphone',async()=>{
  const f=fake('',()=>new Promise<void>(()=>{}));const vc=createVoiceInput({now:()=>0,startRecording:cb=>startRecording(cb,f.host),transcribe:async()=>'',secure:()=>true,gate:()=>({ok:true}),onError:()=>{},onText:()=>{},activeConversationId:()=>null});vc.toggle();await flush();vc.cancel();await flush();expect(f.count.tracks).toBe(1);expect(f.count.close).toBe(1)
 })
 it('R03 120s wall deadline releases recording even if audio callbacks stall',async()=>{
  let now=0,stops=0;const vc=createVoiceInput({now:()=>now,startRecording:async()=>({analyser:null as never,stop:async()=>{stops++;return null},cancel(){}}),transcribe:async()=>'',secure:()=>true,gate:()=>({ok:true}),onError:()=>{},onText:()=>{},activeConversationId:()=>null});vc.toggle();await flush();now=120001;vc.tick();try{expect(vc.getSnapshot().phase).not.toBe('recording');expect(stops).toBe(1)}finally{vc.cancel()}
 })
 it('R04 a synchronous audio resume failure releases newly created host',()=>{
  let closed=0;const ra=createReadAloud({synthesize:async()=>new ReadableStream(),createContext:()=>({currentTime:0,resume(){throw Error('device unavailable')},close(){closed++},play(){throw Error('no playback')}}),getVoice:()=> 'stella',canSpeak:()=>({ok:true}),onError:()=>{}});ra.toggle('m','c','text');expect(closed).toBe(1)
 })
 it('R05 abort wakes a pending PCM read and cancels its underlying stream',async()=>{
  let cancels=0;const stream=new ReadableStream<Uint8Array>({cancel(){cancels++}});const abort=new AbortController();const consumer=consumePcm(stream,abort.signal);const pending=consumer.next();abort.abort();await flush();try{expect(cancels).toBe(1)}finally{await stream.cancel().catch(()=>{});void pending}
 })
 it('R06 a rejected recorder resume already has a correct cleanup path',async()=>{
  const f=fake('',()=>Promise.reject(Error('resume denied')));await expect(startRecording(()=>{},f.host)).rejects.toThrow('resume denied');expect(f.count).toMatchObject({tracks:1,close:1})
 })
 it('R07 playback scheduling failure must abort the still-open synthesis request',async()=>{
  let cancels=0,signal:AbortSignal|undefined;const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array([0,40]))},cancel(){cancels++}});const ra=createReadAloud({synthesize:async(_t,_v,s)=>{signal=s;return stream},createContext:()=>({currentTime:0,resume(){},close(){},play(){throw Error('audio source rejected')}}),getVoice:()=> 'stella',canSpeak:()=>({ok:true}),onError:()=>{}});ra.toggle('m','c','text');await flush();expect(ra.getSnapshot().status).toBe('idle');try{expect(signal?.aborted||cancels>0).toBe(true)}finally{ra.stop();await stream.cancel().catch(()=>{})}
 })

})
