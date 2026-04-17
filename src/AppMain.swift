import Cocoa
import WebKit

class DropWebView: WKWebView {
    var onDrop: ((URL) -> Void)?

    override func willOpenMenu(_ menu: NSMenu, with event: NSEvent) {}

    override init(frame: NSRect, configuration: WKWebViewConfiguration) {
        super.init(frame: frame, configuration: configuration)
        registerForDraggedTypes([.fileURL])
    }
    required init?(coder: NSCoder) { fatalError() }

    override func draggingEntered(_ sender: any NSDraggingInfo) -> NSDragOperation {
        if let urls = fileURLs(sender), urls.contains(where: { isOnto($0) }) { return .copy }
        return []
    }

    override func draggingUpdated(_ sender: any NSDraggingInfo) -> NSDragOperation {
        if let urls = fileURLs(sender), urls.contains(where: { isOnto($0) }) { return .copy }
        return []
    }

    override func performDragOperation(_ sender: any NSDraggingInfo) -> Bool {
        guard let urls = fileURLs(sender), let url = urls.first(where: { isOnto($0) }) else { return false }
        onDrop?(url)
        return true
    }

    private func fileURLs(_ info: any NSDraggingInfo) -> [URL]? {
        info.draggingPasteboard.readObjects(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) as? [URL]
    }
    private func isOnto(_ url: URL) -> Bool { ["owl","rdf","ttl","trig"].contains(url.pathExtension.lowercased()) }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var pendingURL: URL?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let screen = NSScreen.main?.frame ?? NSRect(x: 0, y: 0, width: 1200, height: 800)
        let w: CGFloat = 1200, h: CGFloat = 800
        window = NSWindow(contentRect: NSRect(x: (screen.width-w)/2, y: (screen.height-h)/2, width: w, height: h),
                          styleMask: [.titled, .closable, .resizable, .miniaturizable],
                          backing: .buffered, defer: false)
        window.title = "OntoAir"
        window.minSize = NSSize(width: 640, height: 480)

        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        let dw = DropWebView(frame: window.contentView!.bounds, configuration: config)
        dw.autoresizingMask = [.width, .height]
        dw.onDrop = { [weak self] url in self?.loadOntology(url: url) }
        webView = dw
        window.contentView?.addSubview(webView)

        webView.loadHTMLString(welcomeHTML(), baseURL: nil)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        // Load any file that was passed before window was ready
        if let url = pendingURL {
            pendingURL = nil
            loadOntology(url: url)
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ app: NSApplication) -> Bool { true }

    func application(_ application: NSApplication, open urls: [URL]) {
        if let url = urls.first(where: { ["owl","rdf","ttl","trig"].contains($0.pathExtension.lowercased()) }) {
            if webView != nil {
                loadOntology(url: url)
            } else {
                pendingURL = url
            }
        }
    }

    func loadOntology(url: URL) {
        guard let content = try? String(contentsOf: url, encoding: .utf8) else { return }
        let format: String
        switch url.pathExtension.lowercased() {
        case "owl": format = "owl"
        case "rdf": format = "rdf"
        case "trig": format = "ttl"
        default: format = "ttl"
        }
        let escaped = content
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "`", with: "\\`")
            .replacingOccurrences(of: "$", with: "\\$")

        let html = OntoAirHTML.build(bundle: Bundle.main, escaped: escaped, format: format, fileName: url.lastPathComponent)
        webView.loadHTMLString(html, baseURL: nil)
        window.title = "OntoAir - \(url.lastPathComponent)"
    }

    private func welcomeHTML() -> String {
        """
        <!DOCTYPE html><html><head><meta charset='UTF-8'>
        <style>
        body{background:#fff;display:flex;align-items:center;justify-content:center;height:100vh;
             font-family:'SF Pro',system-ui,-apple-system,sans-serif;color:#333;flex-direction:column}
        h1{font-size:28px;font-weight:700;margin-bottom:8px}
        p{font-size:14px;color:#999;margin-top:4px}
        .icon{font-size:64px;margin-bottom:16px;opacity:0.3}
        .formats{margin-top:16px;display:flex;gap:12px}
        .fmt{background:#f5f5f5;border:1px solid #e0e0e0;border-radius:8px;padding:8px 16px;font-size:12px;color:#666}
        </style></head><body>
        <div class='icon'>&#9741;</div>
        <h1>OntoAir</h1>
        <p>Drag & drop an ontology file to preview</p>
        <div class='formats'><div class='fmt'>.owl</div><div class='fmt'>.rdf</div><div class='fmt'>.ttl</div></div>
        </body></html>
        """
    }
}

@main
struct OntoAirApp {
    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        let delegate = AppDelegate()
        app.delegate = delegate
        app.run()
    }
}
