import Foundation
import ImageIO
import CoreImage
import CoreImage.CIFilterBuiltins

// The caller supplies a point on neutral paper, in normalized top-left coordinates.
// Sampling and channel gains both use linear sRGB; export uses display sRGB.
enum ChekiWhiteBalanceProcessor {
  static func adjust(uri: String, x: Double, y: Double, strength: Double) throws -> [String: Any] {
    guard [x, y, strength].allSatisfy({ $0.isFinite && (0...1).contains($0) }),
          let url = URL(string: uri), url.isFileURL,
          let image = CIImage(contentsOf: url) else { throw ChekiCropError.unreadableImage }
    let extent = image.extent
    if strength == 0 {
      return ["uri": uri, "width": Int(extent.width), "height": Int(extent.height)]
    }
    let linear = CGColorSpace(name: CGColorSpace.extendedLinearSRGB)!
    let context = CIContext(options: [.workingColorSpace: linear])
    let radius = max(1, (min(extent.width, extent.height) * 0.01).rounded())
    let region = CGRect(x: extent.minX + x * extent.width - radius,
                        y: extent.minY + (1 - y) * extent.height - radius,
                        width: radius * 2 + 1, height: radius * 2 + 1)
      .integral.intersection(extent)
    let width = Int(region.width), height = Int(region.height)
    var pixels = [Float](repeating: 0, count: width * height * 4)
    pixels.withUnsafeMutableBytes { bytes in
      context.render(image, toBitmap: bytes.baseAddress!, rowBytes: width * 4 * MemoryLayout<Float>.size,
                     bounds: region, format: .RGBAf, colorSpace: linear)
    }
    var red: [Float] = [], green: [Float] = [], blue: [Float] = []
    for offset in stride(from: 0, to: pixels.count, by: 4) {
      let r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2]
      let luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
      // Dark ink/shadows and clipped highlights cannot provide a reliable white reference.
      if luminance > 0.12 && min(r, g, b) > 0.02 && max(r, g, b) < 0.98 {
        red.append(r); green.append(g); blue.append(b)
      }
    }
    guard red.count * 2 >= width * height else {
      throw NSError(domain: "ChekiWhiteBalance", code: 1, userInfo: [
        NSLocalizedDescriptionKey: "这块区域太暗或过曝，请重新点选没有签名、阴影或反光的白边。",
      ])
    }
    red.sort(); green.sort(); blue.sort()
    let mid = red.count / 2
    let r = Double(red[mid]), g = Double(green[mid]), b = Double(blue[mid])
    // Neutralize chroma without forcing the sample to pure white or changing its luminance.
    let neutral = 0.2126 * r + 0.7152 * g + 0.0722 * b
    let filter = CIFilter.colorMatrix()
    filter.inputImage = image
    filter.rVector = CIVector(x: 1 + strength * (neutral / r - 1), y: 0, z: 0, w: 0)
    filter.gVector = CIVector(x: 0, y: 1 + strength * (neutral / g - 1), z: 0, w: 0)
    filter.bVector = CIVector(x: 0, y: 0, z: 1 + strength * (neutral / b - 1), w: 0)
    let output = filter.outputImage!
    let destination = FileManager.default.temporaryDirectory.appendingPathComponent("cheki-wb-\(UUID().uuidString).jpg")
    try context.writeJPEGRepresentation(of: output, to: destination,
      colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!,
      options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.94])
    return ["uri": destination.absoluteString, "width": Int(extent.width), "height": Int(extent.height)]
  }
}
