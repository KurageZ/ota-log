import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins

@main
struct ChekiWhiteBalanceSmoke {
  static func main() throws {
    let context = CIContext(options: [.workingColorSpace: CGColorSpace(name: CGColorSpace.extendedLinearSRGB)!])
    let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
    let directory = URL(fileURLWithPath: CommandLine.arguments[1])
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let warm = CIImage(color: CIColor(red: 0.75, green: 0.6, blue: 0.45)).cropped(to: CGRect(x: 0, y: 350, width: 500, height: 350))
    let cool = CIImage(color: CIColor(red: 0.45, green: 0.6, blue: 0.75)).cropped(to: CGRect(x: 0, y: 0, width: 500, height: 350))
    let ink = CIImage(color: .black).cropped(to: CGRect(x: 49, y: 629, width: 3, height: 3))
    let fixture = ink.composited(over: warm.composited(over: cool))
    let input = directory.appendingPathComponent("warm-cool-with-ink.png")
    try context.writePNGRepresentation(of: fixture, to: input, format: .RGBA8, colorSpace: srgb)

    func color(_ uri: String, _ rect: CGRect) -> [Float] {
      let image = CIImage(contentsOf: URL(string: uri)!)!
      let average = CIFilter.areaAverage()
      average.inputImage = image
      average.extent = rect
      var values = [Float](repeating: 0, count: 4)
      context.render(average.outputImage!, toBitmap: &values, rowBytes: 16,
                     bounds: CGRect(x: 0, y: 0, width: 1, height: 1), format: .RGBAf,
                     colorSpace: CGColorSpace(name: CGColorSpace.extendedLinearSRGB)!)
      return values
    }
    let rect = CGRect(x: 100, y: 600, width: 20, height: 20)
    let original = color(input.absoluteString, rect)
    let full = try ChekiWhiteBalanceProcessor.adjust(uri: input.absoluteString, x: 0.1, y: 0.1, strength: 1)
    let balanced = color(full["uri"] as! String, rect)
    precondition(abs(balanced[0] - balanced[1]) < 0.025 && abs(balanced[1] - balanced[2]) < 0.025, "Warm sample must become neutral despite a small ink mark")
    let luma: ([Float]) -> Float = { 0.2126 * $0[0] + 0.7152 * $0[1] + 0.0722 * $0[2] }
    precondition(abs(luma(balanced) - luma(original)) < 0.025, "Sample luminance must be preserved")
    let half = try ChekiWhiteBalanceProcessor.adjust(uri: input.absoluteString, x: 0.1, y: 0.1, strength: 0.5)
    let partial = color(half["uri"] as! String, rect)
    precondition(partial[0] - partial[2] > 0.03 && partial[0] - partial[2] < original[0] - original[2])
    let bottom = try ChekiWhiteBalanceProcessor.adjust(uri: input.absoluteString, x: 0.1, y: 0.9, strength: 1)
    let bottomColor = color(bottom["uri"] as! String, CGRect(x: 100, y: 50, width: 20, height: 20))
    precondition(abs(bottomColor[0] - bottomColor[2]) < 0.025, "Top-left coordinate conversion must sample the cool bottom")
    let zero = try ChekiWhiteBalanceProcessor.adjust(uri: input.absoluteString, x: 0.1, y: 0.1, strength: 0)
    precondition(zero["uri"] as! String == input.absoluteString)
    let grayURL = directory.appendingPathComponent("neutral.png")
    let gray = CIImage(color: CIColor(red: 0.6, green: 0.6, blue: 0.6)).cropped(to: CGRect(x: 0, y: 0, width: 100, height: 100))
    try context.writePNGRepresentation(of: gray, to: grayURL, format: .RGBA8, colorSpace: srgb)
    let neutralResult = try ChekiWhiteBalanceProcessor.adjust(uri: grayURL.absoluteString, x: 0.5, y: 0.5, strength: 1)
    let neutralColor = color(neutralResult["uri"] as! String, CGRect(x: 20, y: 20, width: 20, height: 20))
    precondition(abs(neutralColor[0] - neutralColor[2]) < 0.01, "Already-neutral paper must remain neutral")
    for (name, shade) in [("black", CIColor.black), ("clipped", CIColor.white)] {
      let url = directory.appendingPathComponent("\(name).png")
      try context.writePNGRepresentation(of: CIImage(color: shade).cropped(to: CGRect(x: 0, y: 0, width: 100, height: 100)), to: url, format: .RGBA8, colorSpace: srgb)
      do {
        _ = try ChekiWhiteBalanceProcessor.adjust(uri: url.absoluteString, x: 0.5, y: 0.5, strength: 1)
        fatalError("Unusable reference must fail: \(name)")
      } catch { precondition((error as NSError).domain == "ChekiWhiteBalance") }
    }
    _ = try ChekiWhiteBalanceProcessor.adjust(uri: input.absoluteString, x: 0, y: 0, strength: 1)
    print("PASS: warm/cool neutralization, sample orientation, sparse ink, luminance, partial/zero strength, clipped/dark rejection, image-edge sampling")
  }
}
