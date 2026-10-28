import type { IncomingMessage } from "node:http";

const MAX_MULTIPART_BYTES = 5 * 1024 * 1024 + 512 * 1024;

export type MultipartFile = {
  fieldName: string;
  fileName: string;
  contentType: string;
  data: Buffer;
};

export type ParsedMultipart = {
  fields: Record<string, string>;
  files: MultipartFile[];
};

function parseHeaders(value: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of value.split("\r\n")) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    headers[line.slice(0, separator).trim().toLowerCase()] = line
      .slice(separator + 1)
      .trim();
  }
  return headers;
}

function parseDisposition(value: string) {
  const name = value.match(/\bname="([^"]*)"/i)?.[1] ?? "";
  const encodedName = value.match(/\bfilename\*=UTF-8''([^;]+)/i)?.[1];
  const fileName =
    (encodedName
      ? decodeURIComponent(encodedName)
      : value.match(/\bfilename="([^"]*)"/i)?.[1]) ?? "";
  return { name, fileName };
}

async function readRequest(req: IncomingMessage): Promise<Buffer> {
  const declaredLength = Number(req.headers["content-length"] ?? 0);
  if (declaredLength > MAX_MULTIPART_BYTES) {
    throw new Error("Upload exceeds the 5 MB file limit");
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_MULTIPART_BYTES) {
      throw new Error("Upload exceeds the 5 MB file limit");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export async function parseMultipartRequest(
  req: IncomingMessage,
): Promise<ParsedMultipart> {
  const contentType = String(req.headers["content-type"] ?? "");
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundary) throw new Error("Multipart boundary is missing");

  const body = await readRequest(req);
  const delimiter = Buffer.from(`--${boundary}`);
  const fields: Record<string, string> = {};
  const files: MultipartFile[] = [];
  let cursor = 0;

  while (cursor < body.length) {
    const boundaryStart = body.indexOf(delimiter, cursor);
    if (boundaryStart < 0) break;
    let partStart = boundaryStart + delimiter.length;
    if (body.subarray(partStart, partStart + 2).toString() === "--") break;
    if (body.subarray(partStart, partStart + 2).toString() === "\r\n")
      partStart += 2;

    const headersEnd = body.indexOf(Buffer.from("\r\n\r\n"), partStart);
    if (headersEnd < 0) break;
    const headers = parseHeaders(
      body.subarray(partStart, headersEnd).toString("utf8"),
    );
    const dataStart = headersEnd + 4;
    const nextBoundary = body.indexOf(
      Buffer.concat([Buffer.from("\r\n"), delimiter]),
      dataStart,
    );
    if (nextBoundary < 0) break;

    const data = body.subarray(dataStart, nextBoundary);
    const disposition = parseDisposition(headers["content-disposition"] ?? "");
    if (disposition.name) {
      if (disposition.fileName) {
        files.push({
          fieldName: disposition.name,
          fileName: disposition.fileName,
          contentType: headers["content-type"] ?? "application/octet-stream",
          data,
        });
      } else {
        fields[disposition.name] = data.toString("utf8");
      }
    }

    cursor = nextBoundary + 2;
  }

  return { fields, files };
}
