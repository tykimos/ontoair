import Cocoa
import WebKit

class DropWebView: WKWebView, WKUIDelegate {
    var onDrop: ((URL) -> Void)?

    override func willOpenMenu(_ menu: NSMenu, with event: NSEvent) {}

    override init(frame: NSRect, configuration: WKWebViewConfiguration) {
        super.init(frame: frame, configuration: configuration)
        registerForDraggedTypes([.fileURL])
        self.uiDelegate = self
    }
    required init?(coder: NSCoder) { fatalError() }

    // Auto-grant camera permission for MediaPipe hand tracking (NSCameraUsageDescription handles user consent)
    func webView(_ webView: WKWebView,
                 requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo,
                 type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.grant)
    }

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

class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler {
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
        // Allow the loaded page to fetch sibling file:// resources (MediaPipe WASM/.data files).
        config.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        // Enable MediaDevices (getUserMedia) for in-app camera-based hand control.
        config.preferences.setValue(true, forKey: "mediaDevicesEnabled")
        // JS bridge for in-page actions (e.g., TBox merge → reload with combined text).
        let userContent = WKUserContentController()
        userContent.add(self, name: "ontoair")
        config.userContentController = userContent
        let dw = DropWebView(frame: window.contentView!.bounds, configuration: config)
        dw.autoresizingMask = [.width, .height]
        dw.onDrop = { [weak self] url in self?.loadOntology(url: url) }
        if #available(macOS 13.3, *) { dw.isInspectable = true }
        webView = dw
        window.contentView?.addSubview(webView)

        webView.loadHTMLString(welcomeHTML(), baseURL: Bundle.main.resourceURL)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

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
        loadOntologyContent(text: content, format: format, fileName: url.lastPathComponent)
    }

    func loadOntologyContent(text: String, format: String, fileName: String) {
        let escaped = text
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "`", with: "\\`")
            .replacingOccurrences(of: "$", with: "\\$")
        let html = OntoAirHTML.build(bundle: Bundle.main, escaped: escaped, format: format, fileName: fileName)
        // Use bundle resource URL as base so MediaPipe assets (mediapipe/*) load via relative paths
        webView.loadHTMLString(html, baseURL: Bundle.main.resourceURL)
        window.title = "OntoAir - \(fileName)"
    }

    // MARK: - WKScriptMessageHandler
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "ontoair",
              let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }
        switch action {
        case "loadText":
            let text = body["text"] as? String ?? ""
            let fmt = (body["fmt"] as? String).flatMap { ["owl","rdf","ttl"].contains($0) ? $0 : nil } ?? "ttl"
            let name = body["name"] as? String ?? "untitled"
            loadOntologyContent(text: text, format: fmt, fileName: name)
        default:
            break
        }
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
