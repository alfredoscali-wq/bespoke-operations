function encodeLength(length: number): Buffer {
  if (length < 0x80) {
    return Buffer.from([length])
  }
  if (length < 0x4000) {
    return Buffer.from([(length >> 8) | 0x80, length & 0xff])
  }
  if (length < 0x200000) {
    return Buffer.from([
      (length >> 16) | 0xc0,
      (length >> 8) & 0xff,
      length & 0xff,
    ])
  }
  if (length < 0x10000000) {
    return Buffer.from([
      (length >> 24) | 0xe0,
      (length >> 16) & 0xff,
      (length >> 8) & 0xff,
      length & 0xff,
    ])
  }
  return Buffer.concat([
    Buffer.from([0xf0]),
    Buffer.from([
      (length >> 24) & 0xff,
      (length >> 16) & 0xff,
      (length >> 8) & 0xff,
      length & 0xff,
    ]),
  ])
}

export function encodeSentence(words: string[]): Buffer {
  const parts = words.map((word) => {
    const data = Buffer.from(word, "utf8")
    return Buffer.concat([encodeLength(data.length), data])
  })
  return Buffer.concat([...parts, encodeLength(0)])
}

export function decodeLength(buffer: Buffer, offset: number): {
  length: number
  size: number
} {
  if (offset >= buffer.length) {
    throw new Error("Buffer incompleto al leer longitud RouterOS.")
  }
  const first = buffer[offset]
  if (first === undefined) {
    throw new Error("Buffer incompleto al leer longitud RouterOS.")
  }
  if ((first & 0x80) === 0) {
    return { length: first, size: 1 }
  }
  if ((first & 0xc0) === 0x80) {
    if (offset + 1 >= buffer.length) {
      throw new Error("Buffer incompleto al leer longitud RouterOS.")
    }
    return {
      length: ((first & 0x7f) << 8) + (buffer[offset + 1] ?? 0),
      size: 2,
    }
  }
  if ((first & 0xe0) === 0xc0) {
    return {
      length:
        ((first & 0x1f) << 16) +
        ((buffer[offset + 1] ?? 0) << 8) +
        (buffer[offset + 2] ?? 0),
      size: 3,
    }
  }
  if ((first & 0xf0) === 0xe0) {
    return {
      length:
        ((first & 0x0f) << 24) +
        ((buffer[offset + 1] ?? 0) << 16) +
        ((buffer[offset + 2] ?? 0) << 8) +
        (buffer[offset + 3] ?? 0),
      size: 4,
    }
  }
  return {
    length:
      ((buffer[offset + 1] ?? 0) << 24) +
      ((buffer[offset + 2] ?? 0) << 16) +
      ((buffer[offset + 3] ?? 0) << 8) +
      (buffer[offset + 4] ?? 0),
    size: 5,
  }
}

export type RouterOsSentence = {
  type: string
  attributes: Record<string, string>
}

export function parseWords(words: string[]): RouterOsSentence {
  const type = words[0] ?? ""
  const attributes: Record<string, string> = {}
  for (const word of words.slice(1)) {
    if (!word.startsWith("=")) continue
    const rest = word.slice(1)
    const eq = rest.indexOf("=")
    if (eq === -1) {
      attributes[rest] = ""
      continue
    }
    attributes[rest.slice(0, eq)] = rest.slice(eq + 1)
  }
  return { type, attributes }
}

export function decodeSentences(buffer: Buffer): {
  sentences: RouterOsSentence[]
  rest: Buffer
} {
  const sentences: RouterOsSentence[] = []
  let offset = 0
  let words: string[] = []

  while (offset < buffer.length) {
    let decoded: { length: number; size: number }
    try {
      decoded = decodeLength(buffer, offset)
    } catch {
      break
    }
    if (offset + decoded.size + decoded.length > buffer.length) {
      break
    }
    offset += decoded.size
    if (decoded.length === 0) {
      if (words.length > 0) {
        sentences.push(parseWords(words))
        words = []
      }
      continue
    }
    words.push(buffer.subarray(offset, offset + decoded.length).toString("utf8"))
    offset += decoded.length
  }

  return { sentences, rest: buffer.subarray(offset) }
}
