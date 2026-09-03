import assert from 'node:assert/strict'
import path from 'node:path'
import test, { after, before } from 'node:test'
import { SwiftCliError } from '@cbcruk/swift-bridge'
import {
  extractPdf,
  pdfCliBinary,
  readPdfInfo,
  readStructure,
  renderPdf,
} from '../dist/index.js'

const fake = path.join(import.meta.dirname, 'fixtures', 'fake-pdf-cli.mjs')
const previous = process.env.SWIFTX_PDF_CLI_BIN

before(() => {
  process.env.SWIFTX_PDF_CLI_BIN = fake
})

after(() => {
  if (previous === undefined) delete process.env.SWIFTX_PDF_CLI_BIN
  else process.env.SWIFTX_PDF_CLI_BIN = previous
  delete process.env.FAKE_EXIT
  delete process.env.FAKE_STDERR
})

test('pdfCliBinary는 환경변수를 따르고, 명시 경로가 있으면 그것을 쓴다', () => {
  assert.equal(pdfCliBinary(), fake)
  assert.equal(pdfCliBinary('/opt/pdf-cli'), '/opt/pdf-cli')
})

test('readPdfInfo는 info 결과를 파싱한다', async () => {
  const info = await readPdfInfo('/tmp/paper.pdf')

  assert.equal(info.pageCount, 3)
  assert.equal(info.hasTextLayer, true)
  assert.deepEqual(info.__args, ['info', '/tmp/paper.pdf'])
})

test('extractPdf는 페이지별 줄을 돌려준다', async () => {
  const result = await extractPdf('/tmp/paper.pdf')

  assert.equal(result.pages[0].lines[0].text, 'Hello')
  assert.deepEqual(result.__args, ['extract', '/tmp/paper.pdf'])
})

test('readStructure는 옵션 없이는 플래그를 붙이지 않는다', async () => {
  const result = await readStructure('/tmp/scan.pdf')

  assert.deepEqual(result.__args, ['structure', '/tmp/scan.pdf'])
})

test('readStructure는 languages/pages/scale을 CLI 플래그로 옮긴다', async () => {
  const result = await readStructure('/tmp/scan.pdf', {
    languages: ['ko-KR', 'en-US'],
    pages: [0, 3],
    scale: 2,
  })

  assert.deepEqual(result.__args, [
    'structure',
    '/tmp/scan.pdf',
    '--languages',
    'ko-KR,en-US',
    '--pages',
    '0,3',
    '--scale',
    '2',
  ])
})

test('readStructure는 빈 배열을 플래그로 만들지 않는다', async () => {
  const result = await readStructure('/tmp/scan.pdf', { languages: [], pages: [] })

  assert.deepEqual(result.__args, ['structure', '/tmp/scan.pdf'])
})

test('renderPdf는 블록을 stdin으로 넘기고 출력 경로를 인자로 준다', async () => {
  const blocks = [
    { type: 'heading', text: '제목' },
    { type: 'table', text: '', rows: [['a', 'b']] },
  ]
  const result = await renderPdf(blocks, '/tmp/out.pdf')

  assert.deepEqual(result.__args, ['render', '--output', '/tmp/out.pdf'])
  assert.deepEqual(result.__stdin, { blocks })
  assert.equal(result.output, '/tmp/out.pdf')
  assert.equal(result.pageCount, 2)
})

test('CLI 실패는 종료 코드를 보존한 SwiftCliError가 된다', async () => {
  process.env.FAKE_EXIT = '2'
  process.env.FAKE_STDERR = 'cannot open PDF: /tmp/missing.pdf'
  after(() => {
    delete process.env.FAKE_EXIT
    delete process.env.FAKE_STDERR
  })

  await assert.rejects(
    () => readPdfInfo('/tmp/missing.pdf'),
    (error) => {
      assert.ok(error instanceof SwiftCliError)
      assert.equal(error.exitCode, 2)
      assert.equal(
        error.message,
        'fake-pdf-cli.mjs exited with code 2: pdf-cli: cannot open PDF: /tmp/missing.pdf'
      )
      return true
    }
  )
})
