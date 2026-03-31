import { buildServer } from './server'

const PORT = parseInt(process.env.PORT ?? '3000', 10)
const HOST = process.env.HOST ?? '0.0.0.0'

async function main() {
  const server = await buildServer()
  await server.listen({ port: PORT, host: HOST })
  console.log(`ShadowCTX API listening on http://${HOST}:${PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
