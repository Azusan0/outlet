import { constants as zlibConstants, inflateSync } from "node:zlib";

const MAX_DECOMPRESSED_BYTES = 20 * 1024 * 1024;

function decodePdfLiteral(value: string): string {
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== "\\") {
      output += character;
      continue;
    }

    const next = value[index + 1];
    if (!next) break;
    index += 1;

    const escapes: Record<string, string> = {
      n: "\n",
      r: "\r",
      t: "\t",
      b: "\b",
      f: "\f",
      "(": "(",
      ")": ")",
      "\\": "\\",
    };
    if (escapes[next]) {
      output += escapes[next];
      continue;
    }
    if (next === "\n") continue;
    if (next === "\r") {
      if (value[index + 1] === "\n") index += 1;
      continue;
    }
    if (/[0-7]/.test(next)) {
      const octal =
        `${next}${value[index + 1] ?? ""}${value[index + 2] ?? ""}`.match(
          /^[0-7]{1,3}/,
        )?.[0];
      if (octal) {
        output += String.fromCharCode(Number.parseInt(octal, 8));
        index += octal.length - 1;
      }
      continue;
    }
    output += next;
  }
  return output;
}

function decodePdfHex(value: string): string {
  const normalized = value.replace(/\s+/g, "");
  const padded = normalized.length % 2 ? `${normalized}0` : normalized;
  if (!/^[0-9a-f]*$/i.test(padded)) return "";

  const bytes = Buffer.from(padded, "hex");
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const utf16 = Buffer.from(bytes.subarray(2));
    if (utf16.length % 2) return utf16.subarray(0, -1).toString("utf16le");
    utf16.swap16();
    return utf16.toString("utf16le");
  }

  const looksUtf16 =
    bytes.length > 4 &&
    bytes.filter((byte) => byte === 0).length > bytes.length / 3;
  if (looksUtf16) {
    const utf16 = Buffer.from(bytes.length % 2 ? bytes.subarray(0, -1) : bytes);
    utf16.swap16();
    return utf16.toString("utf16le");
  }
  return bytes.toString("latin1");
}

function extractTextFromContentStream(content: string): string {
  const tokenPattern =
    /\((?:\\.|[^\\()])*\)|<[\da-fA-F\s]+>|T\*|(?:[-+]?\d*\.?\d+\s+){2}T[dD]|ET/g;
  const output: string[] = [];

  for (const match of content.matchAll(tokenPattern)) {
    const token = match[0];
    if (token.startsWith("(")) {
      output.push(decodePdfLiteral(token.slice(1, -1)));
    } else if (token.startsWith("<")) {
      output.push(decodePdfHex(token.slice(1, -1)));
    } else if (
      token === "T*" ||
      token.endsWith("Td") ||
      token.endsWith("TD") ||
      token === "ET"
    ) {
      output.push("\n");
    }
  }

  return output
    .join(" ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function inflatePdfStream(data: Buffer): Buffer | null {
  try {
    return inflateSync(data);
  } catch {
    try {
      return inflateSync(data, {
        finishFlush: zlibConstants.Z_SYNC_FLUSH,
      });
    } catch {
      return null;
    }
  }
}

export function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const sections: string[] = [];
  let cursor = 0;

  while (cursor < raw.length) {
    const streamStart = raw.indexOf("stream", cursor);
    if (streamStart < 0) break;
    const dictionaryStart = raw.lastIndexOf("<<", streamStart);
    const dictionary = raw.slice(Math.max(0, dictionaryStart), streamStart);

    let dataStart = streamStart + "stream".length;
    if (raw[dataStart] === "\r" && raw[dataStart + 1] === "\n") dataStart += 2;
    else if (raw[dataStart] === "\n" || raw[dataStart] === "\r") dataStart += 1;

    const streamEnd = raw.indexOf("endstream", dataStart);
    if (streamEnd < 0) break;

    let data = buffer.subarray(dataStart, streamEnd);
    if (dictionary.includes("/FlateDecode")) {
      const inflated = inflatePdfStream(data);
      if (!inflated || inflated.length > MAX_DECOMPRESSED_BYTES) {
        cursor = streamEnd + "endstream".length;
        continue;
      }
      data = inflated;
    }

    const content = data.toString("latin1");
    if (
      content.includes("BT") &&
      (content.includes("Tj") || content.includes("TJ"))
    ) {
      const extracted = extractTextFromContentStream(content);
      if (extracted) sections.push(extracted);
    }
    cursor = streamEnd + "endstream".length;
  }

  const text = sections
    .join("\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  const readableCharacters =
    text.match(/[A-Za-z0-9\u3400-\u9fff]/g)?.length ?? 0;
  if (readableCharacters < 10) {
    throw new Error(
      "PDF contains no extractable text. Scanned PDFs or CID-encoded fonts require OCR/ToUnicode support.",
    );
  }
  return text;
}
