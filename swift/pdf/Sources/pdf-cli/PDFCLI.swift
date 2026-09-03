import Foundation
import SwiftXKit

@main
struct PDFCLI {
    static func main() async {
        await run()
    }

    nonisolated static func run() async {
        var args = Array(CommandLine.arguments.dropFirst())
        guard args.isEmpty == false else {
            printUsage()
            exit(ExitCode.usage.rawValue)
        }
        let command = args.removeFirst()
        switch command {
        case "info":
            runInfo(args)
        case "extract":
            runExtract(args)
        case "render":
            runRender(args)
        case "structure":
            await runStructure(args)
        case "--help", "-h":
            printUsage()
            exit(ExitCode.ok.rawValue)
        default:
            fail("unknown command: \(command)", .usage)
        }
    }

    static func printUsage() {
        print("""
        usage: pdf-cli <command>

        commands:
          info <input.pdf>       print {"pageCount","hasTextLayer"} as JSON
          extract <input.pdf>    print per-page lines with font sizes as JSON
          structure <input.pdf> [--languages ko-KR,en-US] [--scale 3]
                                 rasterize pages and detect document structure
                                 (title, paragraphs, tables with cells, lists)
                                 via RecognizeDocumentsRequest
          render --output <out.pdf>
                                 read {"blocks":[{"type":"heading"|"body","text"}]}
                                 from stdin and write a reflowed PDF

        exit codes: 0 ok, 1 usage error, 2 cannot open/parse input, 4 execution failure.
        """)
    }
}
