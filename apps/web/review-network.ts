import {test as base} from '@playwright/test'
export * from '@playwright/test'
const protect=async(context:any)=>{await context.route('**/*',async(route:any)=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1'||u.hostname==='localhost')return route.continue();return route.abort('blockedbyclient')})}
export const test=base.extend({browser:[async({browser}:any,use:any)=>{const original=browser.newContext.bind(browser);browser.newContext=async(options:any)=>{const context=await original({...options,serviceWorkers:'block'});await protect(context);return context};await use(browser);browser.newContext=original},{scope:'worker'}],reviewNoOutside:[async({context}:any,use:any)=>{await protect(context);await use()},{auto:true}]} as any)
