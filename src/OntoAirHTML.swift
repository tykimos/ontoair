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
        return template
            .replacingOccurrences(of: "{{THREE_JS}}", with: threeJS)
            .replacingOccurrences(of: "{{ORBIT_JS}}", with: orbitJS)
            .replacingOccurrences(of: "{{ONTOAIR_JS}}", with: ontoairJS)
            .replacingOccurrences(of: "{{RAW}}", with: escaped)
            .replacingOccurrences(of: "{{FMT}}", with: format)
            .replacingOccurrences(of: "{{FNAME}}", with: fileName)
    }
}
