import { test as base } from '@playwright/test'
export * from '@playwright/test'
export const test=base.extend({context:async({context},use)=>{await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1'&&u.port==='4687')return route.continue();return route.abort('blockedbyclient')});await use(context)}})
