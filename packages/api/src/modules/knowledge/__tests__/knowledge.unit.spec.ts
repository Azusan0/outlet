import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { deflateSync } from "node:zlib";
import { chunkDocumentText, normalizeDocumentText } from "../chunking";
import { parseMultipartRequest } from "../multipart";
import { extractPdfText } from "../pdf";
import { rankKnowledgeChunks } from "../search";
import { KnowledgeModuleService } from "../service";

describe("knowledge chunking", () => {
  it("normalizes text and creates bounded overlapping chunks", () => {
    const source = `${"补货规则。".repeat(220)}\n\n${"库存复核。".repeat(180)}`;
    const chunks = chunkDocumentText(source);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.content.length <= 1_000)).toBe(true);
    expect(chunks.every((chunk) => chunk.token_estimate > 0)).toBe(true);
    expect(normalizeDocumentText("A \r\n\r\n\r\n\r\n B")).toBe("A\n\n\nB");
  });
});

describe("knowledge BM25 retrieval", () => {
  it("ranks a relevant Chinese chunk and returns citation fields", () => {
    const results = rankKnowledgeChunks(
      "库存补货规则",
      [
        {
          id: "chunk_1",
          document_id: "doc_1",
          tenant_id: "tenant_1",
          position: 0,
          content: "库存低于安全库存时，运营应发起补货预览并等待负责人审批。",
        },
        {
          id: "chunk_2",
          document_id: "doc_2",
          tenant_id: "tenant_1",
          position: 0,
          content: "会员积分在订单完成后发放。",
        },
      ],
      [
        { id: "doc_1", title: "库存补货 SOP" },
        { id: "doc_2", title: "会员运营" },
      ],
    );

    expect(results[0]).toMatchObject({
      document_id: "doc_1",
      chunk_id: "chunk_1",
      title: "库存补货 SOP",
    });
    expect(results[0].snippet).toContain("补货");
  });
});

describe("knowledge idempotent ingestion", () => {
  it("restores a soft-deleted document and its chunks with restore methods", async () => {
    const service = Object.create(
      KnowledgeModuleService.prototype,
    ) as KnowledgeModuleService;
    const document = {
      id: "doc_deleted",
      tenant_id: "tenant_1",
      title: "Stock SOP",
      source_name: "stock-sop.txt",
      source_type: "upload",
      mime_type: "text/plain",
      size_bytes: 20,
      content_hash: "",
      content: "Check stock twice a day.",
      created_by: "user_1",
      metadata: null,
      created_at: new Date(),
      deleted_at: new Date(),
    };
    const chunks = [
      {
        id: "chunk_deleted",
        tenant_id: "tenant_1",
        document_id: document.id,
        position: 0,
        content: document.content,
        token_estimate: 5,
        deleted_at: new Date(),
      },
    ];
    Object.assign(service, {
      listKnowledgeDocuments: jest.fn().mockResolvedValue([document]),
      restoreKnowledgeDocuments: jest.fn().mockResolvedValue(undefined),
      listKnowledgeChunks: jest.fn().mockResolvedValue(chunks),
      restoreKnowledgeChunks: jest.fn().mockResolvedValue(undefined),
    });

    const result = await service.ingestDocument({
      tenantId: "tenant_1",
      title: document.title,
      sourceName: document.source_name,
      sourceType: "upload",
      mimeType: document.mime_type,
      content: document.content,
      sizeBytes: document.size_bytes,
      createdBy: "user_1",
    });

    expect(result.duplicate).toBe(true);
    expect(service.restoreKnowledgeDocuments).toHaveBeenCalledWith([
      document.id,
    ]);
    expect(service.restoreKnowledgeChunks).toHaveBeenCalledWith([
      "chunk_deleted",
    ]);
  });
});

describe("PDF text extraction", () => {
  it("extracts text from a Flate-compressed content stream", () => {
    const content = Buffer.from(
      "BT /F1 12 Tf 72 720 Td (Inventory SOP: review stock daily.) Tj ET",
    );
    const compressed = deflateSync(content);
    const pdf = Buffer.concat([
      Buffer.from(
        "%PDF-1.4\n1 0 obj\n<< /Length 90 /Filter /FlateDecode >>\nstream\n",
        "latin1",
      ),
      compressed,
      Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
    ]);

    expect(extractPdfText(pdf)).toContain("Inventory SOP");
  });
});

describe("multipart parser", () => {
  it("parses a text file and fields without an external middleware", async () => {
    const boundary = "outlet-test-boundary";
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="title"',
      "",
      "Warehouse SOP",
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="sop.txt"',
      "Content-Type: text/plain",
      "",
      "Check inbound stock twice a day.",
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const request = Readable.from([
      Buffer.from(body),
    ]) as unknown as IncomingMessage;
    request.headers = {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "content-length": String(Buffer.byteLength(body)),
    };

    const parsed = await parseMultipartRequest(request);
    expect(parsed.fields.title).toBe("Warehouse SOP");
    expect(parsed.files[0].fileName).toBe("sop.txt");
    expect(parsed.files[0].data.toString()).toContain("twice a day");
  });
});
