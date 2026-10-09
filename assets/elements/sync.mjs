import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(await readFile(join(root, 'sources.json'), 'utf8'))
const output = join(root, 'icons')
const pngMagic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const pending = []

for (const item of manifest.elements) {
  const { filename, thumbnailUrl } = item.icon
  if (!/^[a-z]+\.png$/.test(filename)) throw new Error('Unsafe filename: ' + filename)
  const response = await fetch(thumbnailUrl, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(item.key + ': HTTP ' + response.status)
  const data = Buffer.from(await response.arrayBuffer())
  if (data.length < 32 || !data.subarray(0, 8).equals(pngMagic)) {
    throw new Error(item.key + ': source is not a PNG')
  }
  pending.push({ filename, data })
}

await mkdir(output, { recursive: true })
for (const { filename, data } of pending) {
  await writeFile(join(output, filename), data)
  const sha256 = createHash('sha256').update(data).digest('hex')
  console.log(filename + ' | ' + data.length + ' bytes | sha256 ' + sha256)
}
console.log('Seven BWiki 20px icon thumbnails saved to ' + output)
