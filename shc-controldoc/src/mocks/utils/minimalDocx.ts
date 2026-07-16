// Minimal ZIP (STORED, no compression) + OOXML WordprocessingML writer.
// Produces a genuinely valid, openable .docx for MSW mock responses — no
// third-party zip/docx dependency needed for a single-paragraph placeholder.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

interface ZipEntry {
  name: string
  data: Uint8Array
}

// DOS date/time encoding the minimum valid ZIP timestamp (1980-01-01, 00:00:00).
const DOS_TIME = 0
const DOS_DATE = 0x21

function buildZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const data = entry.data
    const crc = crc32(data)

    const localHeader = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(localHeader.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true) // version needed to extract
    localView.setUint16(6, 0, true) // general purpose flag
    localView.setUint16(8, 0, true) // compression method: stored
    localView.setUint16(10, DOS_TIME, true)
    localView.setUint16(12, DOS_DATE, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, data.length, true)
    localView.setUint32(22, data.length, true)
    localView.setUint16(26, nameBytes.length, true)
    localView.setUint16(28, 0, true) // extra field length
    localHeader.set(nameBytes, 30)
    localParts.push(localHeader, data)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(centralHeader.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true) // version made by
    centralView.setUint16(6, 20, true) // version needed to extract
    centralView.setUint16(8, 0, true) // general purpose flag
    centralView.setUint16(10, 0, true) // compression method
    centralView.setUint16(12, DOS_TIME, true)
    centralView.setUint16(14, DOS_DATE, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, data.length, true)
    centralView.setUint16(28, nameBytes.length, true)
    centralView.setUint16(30, 0, true) // extra field length
    centralView.setUint16(32, 0, true) // comment length
    centralView.setUint16(34, 0, true) // disk number start
    centralView.setUint16(36, 0, true) // internal attributes
    centralView.setUint32(38, 0, true) // external attributes
    centralView.setUint32(42, offset, true) // relative offset of local header
    centralHeader.set(nameBytes, 46)
    centralParts.push(centralHeader)

    offset += localHeader.length + data.length
  }

  const centralDirOffset = offset
  const centralDirSize = centralParts.reduce((sum, part) => sum + part.length, 0)

  const endRecord = new Uint8Array(22)
  const endView = new DataView(endRecord.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(4, 0, true) // disk number
  endView.setUint16(6, 0, true) // disk where central directory starts
  endView.setUint16(8, entries.length, true)
  endView.setUint16(10, entries.length, true)
  endView.setUint32(12, centralDirSize, true)
  endView.setUint32(16, centralDirOffset, true)
  endView.setUint16(20, 0, true) // comment length

  const totalSize =
    localParts.reduce((sum, part) => sum + part.length, 0) + centralDirSize + endRecord.length
  const result = new Uint8Array(totalSize)
  let pos = 0
  for (const part of [...localParts, ...centralParts, endRecord]) {
    result.set(part, pos)
    pos += part.length
  }
  return result
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

const PACKAGE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

function escapeXmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildDocumentXml(placeholderText: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t xml:space="preserve">${escapeXmlText(placeholderText)}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`
}

/**
 * Builds a minimal but genuinely valid OOXML .docx (opens without error in
 * Word/LibreOffice) containing a single placeholder paragraph.
 */
export function buildMinimalDocxBytes(placeholderText: string): Uint8Array {
  const encoder = new TextEncoder()
  return buildZip([
    { name: '[Content_Types].xml', data: encoder.encode(CONTENT_TYPES_XML) },
    { name: '_rels/.rels', data: encoder.encode(PACKAGE_RELS_XML) },
    { name: 'word/document.xml', data: encoder.encode(buildDocumentXml(placeholderText)) },
  ])
}
