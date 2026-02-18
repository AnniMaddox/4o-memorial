/** Read a .txt or .docx file handle and return its plain-text content. */
export async function readLetterFile(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  const name = file.name.toLowerCase();

  if (name.endsWith('.txt')) {
    return file.text();
  }

  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    const buffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
    return value;
  }

  return '';
}
