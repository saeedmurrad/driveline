// Labels photos with Apple's on-device Vision classifier (macOS only, no network).
// Prints one JSON object: { "<file name>": { "<label>": confidence, ... }, ... }
// Used by scripts/tag-stock-photos.mjs.
import Foundation
import Vision

var out: [String: [String: Double]] = [:]
for path in CommandLine.arguments.dropFirst() {
  let req = VNClassifyImageRequest()
  let handler = VNImageRequestHandler(url: URL(fileURLWithPath: path))
  try? handler.perform([req])
  var labels: [String: Double] = [:]
  for o in (req.results ?? []) where o.confidence > 0.05 {
    labels[o.identifier] = (Double(o.confidence) * 1000).rounded() / 1000
  }
  out[(path as NSString).lastPathComponent] = labels
}
let data = try! JSONSerialization.data(withJSONObject: out, options: [.sortedKeys])
print(String(data: data, encoding: .utf8)!)
