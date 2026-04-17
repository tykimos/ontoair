import Cocoa
import QuickLookUI
import WebKit

@objc(PreviewViewController)
class PreviewViewController: NSViewController, QLPreviewingController {
    var webView: WKWebView!

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 800, height: 600), configuration: config)
        webView.autoresizingMask = [.width, .height]
        self.view = webView
    }

    func preparePreviewOfFile(at url: URL, completionHandler handler: @escaping (Error?) -> Void) {
        let ext = url.pathExtension.lowercased()
        guard ["owl", "rdf", "ttl", "trig"].contains(ext) else {
            handler(NSError(domain: "OntoAir", code: -1, userInfo: nil))
            return
        }

        guard let content = try? String(contentsOf: url, encoding: .utf8) else {
            handler(NSError(domain: "OntoAir", code: 1, userInfo: nil))
            return
        }

        let format: String
        switch ext {
        case "owl": format = "owl"
        case "rdf": format = "rdf"
        default: format = "ttl"
        }

        let escaped = content
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "`", with: "\\`")
            .replacingOccurrences(of: "$", with: "\\$")

        let bundle = Bundle(for: PreviewViewController.self)
        let html = OntoAirHTML.build(bundle: bundle, escaped: escaped, format: format, fileName: url.lastPathComponent)
        webView.loadHTMLString(html, baseURL: nil)
        handler(nil)
    }
}
