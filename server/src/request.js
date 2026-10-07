export async function readJsonBody(req, maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      const error = new Error(`request body exceeds ${maxBytes} bytes`);
      error.code = 'BODY_TOO_LARGE';
      throw error;
    }
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks).toString('utf8');
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error('invalid JSON body');
    error.code = 'BAD_JSON';
    throw error;
  }
}
