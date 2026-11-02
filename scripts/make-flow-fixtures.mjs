/**
 * Creates three minimal but REAL PDF fixtures (correct %PDF magic bytes) used
 * by the browser flow test to exercise the document upload screens.
 * Written to the approved temp directory; safe to delete afterwards.
 */
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs'

const dir = 'C:/Users/S P A R O/AppData/Local/Temp/opencode/fixtures'
mkdirSync(dir, { recursive: true })

const pdf = (title) =>
  Buffer.from(
    `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length ${14 + title.length} >> stream
BT /F1 18 Tf 72 720 Td (${title}) Tj ET
endstream endobj
trailer << /Root 1 0 R >>
%%EOF`,
    'latin1',
  )

writeFileSync(`${dir}/cv-test.pdf`, pdf('StageFlow CV test'))
writeFileSync(`${dir}/lettre-motivation-test.pdf`, pdf('Lettre de motivation test'))
writeFileSync(`${dir}/attestation-scolarite-test.pdf`, pdf('Attestation de scolarite test'))

// Hostile fixture for the negative case: HTML bytes pretending to be a PDF.
writeFileSync(`${dir}/faux-pdf.html`, Buffer.from('<html><body>embedded script</body></html>'))

console.log(readdirSync(dir).join('\n'))
