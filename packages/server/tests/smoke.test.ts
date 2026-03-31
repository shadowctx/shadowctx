/**
 * End-to-end smoke test for the ShadowCTX API server.
 *
 * Uses an in-memory SQLite database (no file created) and Fastify's built-in
 * inject() method — no real TCP port is opened.
 *
 * Covers:
 *   1. POST /pages — save a page
 *   2. GET /pages/search — search returns the saved page
 */
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { buildServer } from '../src/server.js'
import type { FastifyInstance } from 'fastify'

// Use in-memory SQLite for isolation
process.env.STORE = 'sqlite'
process.env.DB_PATH = ':memory:'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildServer()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('smoke: save + search', () => {
  it('saves a page and retrieves it via search', async () => {
    // 1. Save a page
    const saveRes = await app.inject({
      method: 'POST',
      url: '/pages',
      payload: {
        url: 'https://example.com/test-article',
        title: 'Understanding Transformers',
        content: 'Transformers use self-attention mechanisms to process sequences in parallel.',
        tags: ['ai', 'ml'],
        source: 'api',
      },
    })

    expect(saveRes.statusCode).toBe(201)
    const saved = saveRes.json()
    expect(saved.id).toBeTruthy()
    expect(saved.title).toBe('Understanding Transformers')

    // 2. Search for it — fall back to keyword search (no OPENAI_API_KEY in CI)
    const searchRes = await app.inject({
      method: 'GET',
      url: '/pages/search?q=Transformers',
    })

    expect(searchRes.statusCode).toBe(200)
    const { results } = searchRes.json()
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].page.id).toBe(saved.id)
  })

  it('health check returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })
})
