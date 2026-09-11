// Compile with ChekiCropProcessor.swift and ChekiBoundaryTracker.swift on macOS.
// Synthetic fixture verifies the native image pipeline, not real-photo detection accuracy.
import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins
import ImageIO

@main
struct ChekiCropSmoke {
  static func main() throws {
    var tracker = ChekiBoundaryTracker()
    let corners = [CGPoint(x: 0.1, y: 0.1), CGPoint(x: 0.8, y: 0.1), CGPoint(x: 0.8, y: 0.9), CGPoint(x: 0.1, y: 0.9)]
    precondition(!tracker.update(corners).stable)
    let jitter = corners.map { CGPoint(x: $0.x + 0.005, y: $0.y) }
    let second = tracker.update(jitter)
    precondition(!second.stable && second.points[0].x > 0.1 && second.points[0].x < 0.105)
    precondition(tracker.update(corners).stable)
    let moved = corners.map { CGPoint(x: $0.x + 0.1, y: $0.y) }
    precondition(!tracker.update(moved).stable)
    precondition(tracker.update([]).points.isEmpty)
    precondition(!tracker.update(corners).stable)
    let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let space = CGColorSpace(name: CGColorSpace.sRGB)!
    let context = CIContext()
    let paper = CIImage(color: CIColor.white).cropped(to: CGRect(x: 0, y: 0, width: 540, height: 860))
    let red = CIImage(color: CIColor(red: 0.8, green: 0.15, blue: 0.2)).cropped(to: CGRect(x: 40, y: 120, width: 460, height: 350))
    let blue = CIImage(color: CIColor(red: 0.1, green: 0.3, blue: 0.8)).cropped(to: CGRect(x: 40, y: 470, width: 460, height: 350))
    let transform = CIFilter.perspectiveTransform()
    transform.inputImage = red.composited(over: blue.composited(over: paper))
    transform.topLeft = CGPoint(x: 220, y: 1050)
    transform.topRight = CGPoint(x: 790, y: 950)
    transform.bottomRight = CGPoint(x: 880, y: 170)
    transform.bottomLeft = CGPoint(x: 140, y: 220)
    let background = CIImage(color: CIColor(red: 0.08, green: 0.15, blue: 0.12))
      .cropped(to: CGRect(x: 0, y: 0, width: 1100, height: 1200))
    let fixture = transform.outputImage!.composited(over: background).cropped(to: background.extent)
    let input = directory.appendingPathComponent("slanted-cheki.jpg")
    try context.writeJPEGRepresentation(of: fixture, to: input, colorSpace: space)
    let detection = try ChekiCropProcessor.detect(uri: input.absoluteString)
    let candidates = detection["candidates"] as! [[String: Any]]
    precondition(!candidates.isEmpty, "Expected a rectangle in synthetic photo")
    let expected: [Double] = [220.0 / 1100, 150.0 / 1200, 790.0 / 1100, 250.0 / 1200, 880.0 / 1100, 1030.0 / 1200, 140.0 / 1100, 980.0 / 1200]
    let matched = candidates.first { candidate in
      zip(candidate["corners"] as! [Double], expected).allSatisfy { abs($0 - $1) < 0.035 }
    }
    precondition(matched != nil, "Expected full outer paper, not just inner image")
    let output = try ChekiCropProcessor.crop(uri: detection["uri"] as! String, corners: matched!["corners"] as! [Double])
    let width = output["width"] as! Int
    let height = output["height"] as! Int
    precondition(width > 300 && height > width && height <= 2000)
    let outputURL = URL(string: output["uri"] as! String)!
    let corrected = CIImage(contentsOf: outputURL)!
    let sample = context.createCGImage(corrected, from: corrected.extent)!
    precondition(sample.width == width && sample.height == height)
    try FileManager.default.copyItem(at: outputURL, to: directory.appendingPathComponent("cropped-cheki.jpg"))

    // EXIF orientation is baked into the preview pixels before Vision and the crop UI see it.
    let rotated = directory.appendingPathComponent("orientation-6.jpg")
    let destination = CGImageDestinationCreateWithURL(rotated as CFURL, "public.jpeg" as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, context.createCGImage(fixture, from: fixture.extent)!, [kCGImagePropertyOrientation: 6] as CFDictionary)
    precondition(CGImageDestinationFinalize(destination))
    let oriented = try ChekiCropProcessor.detect(uri: rotated.absoluteString)
    precondition(oriented["width"] as! Int == 1200 && oriented["height"] as! Int == 1100)

    let blankURL = directory.appendingPathComponent("blank.jpg")
    try context.writeJPEGRepresentation(of: background, to: blankURL, colorSpace: space)
    let blank = try ChekiCropProcessor.detect(uri: blankURL.absoluteString)
    precondition((blank["candidates"] as! [[String: Any]]).isEmpty)
    do {
      _ = try ChekiCropProcessor.crop(uri: input.absoluteString, corners: [0, 0, 1, 1, 1, 0, 0, 1])
      fatalError("Crossed corners must fail")
    } catch ChekiCropError.invalidCorners {}
    do {
      _ = try ChekiCropProcessor.detect(uri: directory.appendingPathComponent("missing.jpg").absoluteString)
      fatalError("Missing image must fail")
    } catch ChekiCropError.unreadableImage {}
    print("PASS: tracking stability/jitter/loss/motion reset, outer boundary, perspective output, EXIF orientation, no boundary, invalid corners, missing image")
    print("Fixture and cropped result: \(directory.path)")
  }
}
