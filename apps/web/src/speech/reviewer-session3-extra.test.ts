import {it,expect} from 'vitest'
import {startRecording,type RecordingHost} from './recorder.js'
import {createVoiceInput} from './voiceSession.js'
import {createReadAloud} from './readAloud.js'
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve()}
const deferred=<T,>()=>{let resolve!:(x:T)=>void,reject!:(x:unknown)=>void;const promise=new Promise<T>((r,j)=>{resolve=r;reject=j});return {promise,resolve,reject}}
it('N01 stale permission rejection cannot erase a newer pending recorder cancel handle',async()=>{
 const old=deferred<MediaStream>();let calls=0,tracks=0,closes=0
 const host:RecordingHost={getUserMedia:()=>++calls===1?old.promise:Promise.resolve({getTracks:()=>[{stop(){tracks++}}]} as unknown as MediaStream),createContext:()=>({sampleRate:16000,destination:{} as AudioNode,resume:()=>new Promise<void>(()=>{}),close(){closes++},createMediaStreamSource(){throw Error('not reached')},createAnalyser(){throw Error('not reached')},createScriptProcessor(){throw Error('not reached')}})}
 const v=createVoiceInput({now:()=>0,startRecording:f=>startRecording(f,host),transcribe:async()=>'',secure:()=>true,gate:()=>({ok:true}),onError(){},onText(){},activeConversationId:()=>null})
 v.toggle();await flush();v.cancel();v.toggle();await flush();expect(calls).toBe(2)
 old.reject(new DOMException('old permission rejected late','NotAllowedError'));await flush();v.cancel();await flush();expect({tracks,closes}).toEqual({tracks:1,closes:1})
})
it('N02 stale permission resolution does not erase newer cancel handle (late-grant variant)',async()=>{
 const old=deferred<MediaStream>();let calls=0,newTracks=0,oldTracks=0,closes=0
 const host:RecordingHost={getUserMedia:()=>++calls===1?old.promise:Promise.resolve({getTracks:()=>[{stop(){newTracks++}}]} as unknown as MediaStream),createContext:()=>({sampleRate:16000,destination:{} as AudioNode,resume:()=>new Promise<void>(()=>{}),close(){closes++},createMediaStreamSource(){throw Error('not reached')},createAnalyser(){throw Error('not reached')},createScriptProcessor(){throw Error('not reached')}})}
 const v=createVoiceInput({now:()=>0,startRecording:f=>startRecording(f,host),transcribe:async()=>'',secure:()=>true,gate:()=>({ok:true}),onError(){},onText(){},activeConversationId:()=>null})
 v.toggle();await flush();v.cancel();v.toggle();await flush();old.resolve({getTracks:()=>[{stop(){oldTracks++}}]} as unknown as MediaStream);await flush();v.cancel();await flush();expect({newTracks,oldTracks,closes}).toEqual({newTracks:1,oldTracks:1,closes:1})
})
it('N03 a spontaneous AbortError before synth response still releases its audio context',async()=>{
 let close=0;const ra=createReadAloud({synthesize:async()=>{throw new DOMException('transport internally aborted','AbortError')},createContext:()=>({currentTime:0,resume(){},close(){close++},play(){throw Error('not reached')}}),getVoice:()=> 'stella',canSpeak:()=>({ok:true}),onError(){}})
 ra.toggle('m','c','text');await flush();try{expect({status:ra.getSnapshot().status,close}).toEqual({status:'idle',close:1})}finally{ra.stop()}
})

it('N04 newer pending cancellation works when the obsolete permission has not settled (control)',async()=>{
 let calls=0,tracks=0,closes=0
 const host:RecordingHost={getUserMedia:()=>++calls===1?new Promise<MediaStream>(()=>{}):Promise.resolve({getTracks:()=>[{stop(){tracks++}}]} as unknown as MediaStream),createContext:()=>({sampleRate:16000,destination:{} as AudioNode,resume:()=>new Promise<void>(()=>{}),close(){closes++},createMediaStreamSource(){throw Error('not reached')},createAnalyser(){throw Error('not reached')},createScriptProcessor(){throw Error('not reached')}})}
 const v=createVoiceInput({now:()=>0,startRecording:f=>startRecording(f,host),transcribe:async()=>'',secure:()=>true,gate:()=>({ok:true}),onError(){},onText(){},activeConversationId:()=>null})
 v.toggle();await flush();v.cancel();v.toggle();await flush();v.cancel();await flush();expect({tracks,closes}).toEqual({tracks:1,closes:1})
})
