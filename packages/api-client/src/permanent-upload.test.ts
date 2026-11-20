import { describe, expect, it } from 'vitest'
import { createClient } from './client.js'

const formText = (form: FormData) =>
  [...form.entries()]
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : value.name}`)
    .join('\n')

describe('permanent file upload', () => {
  it('omits expires_after from the on-device upload body', async () => {
    let form: FormData | undefined
    const fetchImpl: typeof fetch = async (_input, init) => {
      form = init?.body as FormData
      return new Response(
        JSON.stringify({ id: 'file-1', bytes: 4, created_at: 1, filename: 'note.txt', purpose: 'user_data' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }
    const client = createClient({ fetch: fetchImpl })
    await client.uploadFile('demo-local-key', new Blob(['note']), 'note.txt', 'user_data')
    const body = formText(form as FormData)
    expect(body).toContain('purpose=user_data')
    expect(body).toContain('file=note.txt')
    expect(body.toLowerCase()).not.toContain('expir')
  })
})
