import AppKit
import Foundation
import PDFKit
import SwiftXKit
import Vision

struct StructuredParagraph: Encodable {
    let text: String
    let box: Box
    let lineCount: Int
}

struct StructuredTable: Encodable {
    let box: Box
    let rows: [[String]]
}

struct StructuredList: Encodable {
    let box: Box
    let items: [String]
}

struct StructuredPage: Encodable {
    let index: Int
    let width: Double
    let height: Double
    let title: String?
    let paragraphs: [StructuredParagraph]
    let tables: [StructuredTable]
    let lists: [StructuredList]

    private enum CodingKeys: String, CodingKey {
        case index, width, height, title, paragraphs, tables, lists
    }

    /// `title`을 명시적으로 `null`로 내보내기 위해 직접 인코딩한다.
    ///
    /// 자동 생성 구현은 Optional에 `encodeIfPresent`를 써서 nil이면 키 자체를 생략한다.
    /// 그러면 제목 없는 페이지의 응답에 `title` 키가 아예 없어 소비자의
    /// `page.title === null` 검사가 빗나간다. 스키마의 모든 필드는 항상 존재해야 한다.
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(index, forKey: .index)
        try container.encode(width, forKey: .width)
        try container.encode(height, forKey: .height)
        try container.encode(title, forKey: .title)
        try container.encode(paragraphs, forKey: .paragraphs)
        try container.encode(tables, forKey: .tables)
        try container.encode(lists, forKey: .lists)
    }
}

struct StructureResult: Encodable {
    let pageCount: Int
    let pages: [StructuredPage]
}

func runStructure(_ args: [String]) async {
    var path: String?
    var languages = ["ko-KR", "en-US"]
    var scale = 3.0
    var pageFilter: Set<Int>?

    var reader = ArgumentReader(args)
    while let argument = reader.next() {
        switch argument {
        case "--pages":
            pageFilter = Set(reader.listValue(for: argument).compactMap { Int($0) })
        case "--languages":
            languages = reader.listValue(for: argument)
        case "--scale":
            scale = reader.doubleValue(for: argument)
        default:
            reader.takePositional(argument, into: &path)
        }
    }
    guard let path else {
        fail("expected a PDF path argument", .usage)
    }
    guard let document = PDFDocument(url: URL(fileURLWithPath: path)) else {
        fail("cannot open PDF: \(path)", .input)
    }

    var request = RecognizeDocumentsRequest()
    request.textRecognitionOptions.recognitionLanguages = languages.map { Locale.Language(identifier: $0) }
    request.textRecognitionOptions.useLanguageCorrection = true

    var pages: [StructuredPage] = []
    for index in 0..<document.pageCount {
        if let pageFilter, !pageFilter.contains(index) { continue }
        guard let page = document.page(at: index) else { continue }
        let bounds = page.bounds(for: .mediaBox)
        let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
        let thumbnail = page.thumbnail(of: size, for: .mediaBox)
        var proposedRect = CGRect(origin: .zero, size: thumbnail.size)
        guard let cgImage = thumbnail.cgImage(forProposedRect: &proposedRect, context: nil, hints: nil) else {
            pages.append(StructuredPage(
                index: index, width: bounds.width, height: bounds.height,
                title: nil, paragraphs: [], tables: [], lists: []
            ))
            continue
        }

        do {
            let observations = try await request.perform(on: cgImage)
            let container = observations.first?.document
            pages.append(structuredPage(from: container, index: index, bounds: bounds))
        } catch {
            fail("document recognition failed on page \(index): \(error)", .failure)
        }
    }

    printJSON(StructureResult(pageCount: document.pageCount, pages: pages))
    exit(ExitCode.ok.rawValue)
}

private func structuredPage(
    from container: DocumentObservation.Container?,
    index: Int,
    bounds: CGRect
) -> StructuredPage {
    guard let container else {
        return StructuredPage(
            index: index, width: bounds.width, height: bounds.height,
            title: nil, paragraphs: [], tables: [], lists: []
        )
    }

    let paragraphs = container.paragraphs.map { text in
        StructuredParagraph(
            text: text.transcript,
            box: box(of: text.boundingRegion, in: bounds),
            lineCount: text.lines.count
        )
    }
    let tables = container.tables.map { table in
        StructuredTable(
            box: box(of: table.boundingRegion, in: bounds),
            rows: table.rows.map { row in
                row.map { cell in
                    cell.content.text.transcript.replacingOccurrences(of: "\n", with: " ")
                }
            }
        )
    }
    let lists = container.lists.map { list in
        StructuredList(
            box: box(of: list.boundingRegion, in: bounds),
            items: list.items.map { item in
                item.itemString.replacingOccurrences(of: "\n", with: " ")
            }
        )
    }

    return StructuredPage(
        index: index,
        width: bounds.width,
        height: bounds.height,
        title: container.title?.transcript,
        paragraphs: paragraphs,
        tables: tables,
        lists: lists
    )
}

private func box(of region: NormalizedRegion, in bounds: CGRect) -> Box {
    denormalize(region.normalizedPath.boundingBox, in: bounds)
}
