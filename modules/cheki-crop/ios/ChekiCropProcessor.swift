import Foundation
import Vision
import CoreImage
import CoreImage.CIFilterBuiltins
import ImageIO

enum ChekiCropError: LocalizedError {
  case unreadableImage
  case invalidCorners
  case failedCorrection

  var errorDescription: String? {
    switch self {
    case .unreadableImage: return "无法读取图片，请选择其他照片。"
    case .invalidCorners: return "裁切边界无效，请重新选择。"
    case .failedCorrection: return "无法完成透视校正，请尝试其他边界。"
    }
  }
}

enum ChekiCropProcessor {
  // ImageIO downsamples during decode and applies EXIF orientation, bounding demo memory use.
  static func detect(uri: String) throws -> [String: Any] {
    guard let url = URL(string: uri), url.isFileURL,
          let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: 2400,
          ] as CFDictionary) else { throw ChekiCropError.unreadableImage }

    let request = VNDetectRectanglesRequest()
    request.maximumObservations = 6
    request.minimumConfidence = 0.5
    request.minimumAspectRatio = 0.3
    request.maximumAspectRatio = 1
    request.minimumSize = 0.15
    request.quadratureTolerance = 45
    try VNImageRequestHandler(cgImage: image, orientation: .up).perform([request])

    // Larger candidates first; users preview/select because a sleeve or table may also be detected.
    let rectangles = (request.results ?? []).sorted {
      $0.boundingBox.width * $0.boundingBox.height > $1.boundingBox.width * $1.boundingBox.height
    }
    var result = try save(CIImage(cgImage: image))
    result["candidates"] = rectangles.map { rectangle -> [String: Any] in
      let points = [rectangle.topLeft, rectangle.topRight, rectangle.bottomRight, rectangle.bottomLeft]
      return [
        "corners": points.flatMap { [Double($0.x), Double(1 - $0.y)] },
        "confidence": Double(rectangle.confidence),
      ]
    }
    return result
  }

  static func crop(uri: String, corners: [Double]) throws -> [String: Any] {
    guard corners.count == 8, corners.allSatisfy({ $0.isFinite && (0...1).contains($0) }) else {
      throw ChekiCropError.invalidCorners
    }
    let points = stride(from: 0, to: 8, by: 2).map { CGPoint(x: corners[$0], y: corners[$0 + 1]) }
    // Validate externally supplied quadrilateral: convex, clockwise in top-left coordinates.
    for index in 0..<4 {
      let a = points[index], b = points[(index + 1) % 4], c = points[(index + 2) % 4]
      guard (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) > 0.00001 else {
        throw ChekiCropError.invalidCorners
      }
    }
    guard let url = URL(string: uri), url.isFileURL,
          let image = CIImage(contentsOf: url) else { throw ChekiCropError.unreadableImage }
    let extent = image.extent
    let vectors = points.map {
      CGPoint(x: extent.minX + $0.x * extent.width, y: extent.minY + (1 - $0.y) * extent.height)
    }
    let filter = CIFilter.perspectiveCorrection()
    filter.inputImage = image
    filter.topLeft = vectors[0]
    filter.topRight = vectors[1]
    filter.bottomRight = vectors[2]
    filter.bottomLeft = vectors[3]
    guard let output = filter.outputImage, !output.extent.isEmpty,
          !output.extent.isInfinite else { throw ChekiCropError.failedCorrection }
    let scale = min(1, 2000 / max(output.extent.width, output.extent.height))
    return try save(output.transformed(by: CGAffineTransform(scaleX: scale, y: scale)))
  }

  private static func save(_ image: CIImage) throws -> [String: Any] {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("cheki-crop-\(UUID().uuidString).jpg")
    try CIContext().writeJPEGRepresentation(
      of: image, to: url, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!,
      options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.94]
    )
    return ["uri": url.absoluteString, "width": Int(image.extent.width.rounded()), "height": Int(image.extent.height.rounded())]
  }
}
