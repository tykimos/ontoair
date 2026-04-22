import Foundation

enum OntoAirHTML {
    static func build(bundle: Bundle, escaped: String, format: String, fileName: String) -> String {
        func load(_ name: String, _ ext: String) -> String {
            guard let url = bundle.url(forResource: name, withExtension: ext),
                  let s = try? String(contentsOf: url, encoding: .utf8) else { return "" }
            return s
        }
        let template = load("template", "html")
        let ontoairJS = load("ontoair", "js")
        let threeJS = load("three.min", "js")
        let orbitJS = load("OrbitControls", "js")
        // Hand control + MediaPipe are only present in the main app bundle, not the QuickLook extension.
        // If hand-control.js is missing from this bundle, skip the entire block (no MediaPipe load attempt).
        let handControlJS = load("hand-control", "js")
        let handControlBlock = handControlJS.isEmpty ? "" :
            "<script src=\"mediapipe/hands.js\"></script>\n<script>\(handControlJS)</script>"
        return template
            .replacingOccurrences(of: "{{THREE_JS}}", with: threeJS)
            .replacingOccurrences(of: "{{ORBIT_JS}}", with: orbitJS)
            .replacingOccurrences(of: "{{ONTOAIR_JS}}", with: ontoairJS)
            .replacingOccurrences(of: "{{HAND_CONTROL_BLOCK}}", with: handControlBlock)
            .replacingOccurrences(of: "{{RAW}}", with: escaped)
            .replacingOccurrences(of: "{{FMT}}", with: format)
            .replacingOccurrences(of: "{{FNAME}}", with: fileName)
    }
}
