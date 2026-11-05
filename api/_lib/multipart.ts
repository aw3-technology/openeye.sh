import type { IncomingMessage } from "node:http";
import busboy from "busboy";
import { HttpError } from "./http.js";

export interface UploadedForm {
  file: { data: Buffer; mimeType: string; filename: string } | null;
  fields: Record<string, string>;
}

/** Vercel caps request bodies at 4.5 MB, so images are kept just under that. */
const MAX_FILE_BYTES = 4 * 1024 * 1024;

export function readMultipart(req: IncomingMessage): Promise<UploadedForm> {
  const type = req.headers["content-type"] ?? "";
  if (!type.startsWith("multipart/form-data")) {
    return Promise.reject(new HttpError(415, "Send the image as multipart/form-data in a field named file"));
  }
  return new Promise((resolve, reject) => {
    const form: UploadedForm = { file: null, fields: {} };
    const bb = busboy({ headers: req.headers, limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 20 } });
    bb.on("file", (name, stream, info) => {
      const chunks: Buffer[] = [];
      stream.on("data", (c: Buffer) => chunks.push(c));
      stream.on("limit", () => reject(new HttpError(413, "Image must be under 4 MB")));
      stream.on("end", () => {
        if (name === "file") form.file = { data: Buffer.concat(chunks), mimeType: info.mimeType, filename: info.filename ?? "" };
      });
    });
    bb.on("field", (name, value) => {
      form.fields[name] = value;
    });
    bb.on("error", () => reject(new HttpError(400, "Malformed multipart body")));
    bb.on("close", () => resolve(form));
    req.pipe(bb);
  });
}
