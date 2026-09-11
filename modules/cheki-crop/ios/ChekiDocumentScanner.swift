import UIKit
import VisionKit

// Retained by the Expo module because VisionKit's delegate is weak.
final class ChekiDocumentScanner: NSObject, VNDocumentCameraViewControllerDelegate {
  private let completion: (Result<[[String: Any]]?, Error>) -> Void

  init(completion: @escaping (Result<[[String: Any]]?, Error>) -> Void) {
    self.completion = completion
  }

  func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
    do {
      var images: [[String: Any]] = []
      for index in 0..<scan.pageCount {
        let image = try autoreleasepool { () throws -> [String: Any] in
          let original = scan.imageOfPage(at: index)
          let scale = min(1, 2000 / max(original.size.width, original.size.height))
          let size = CGSize(width: (original.size.width * scale).rounded(), height: (original.size.height * scale).rounded())
          let format = UIGraphicsImageRendererFormat()
          format.scale = 1
          format.opaque = true
          let normalized = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            original.draw(in: CGRect(origin: .zero, size: size))
          }
          guard let data = normalized.jpegData(compressionQuality: 0.94) else {
            throw ChekiCropError.failedCorrection
          }
          let url = FileManager.default.temporaryDirectory.appendingPathComponent("cheki-scan-\(UUID().uuidString).jpg")
          try data.write(to: url)
          return ["uri": url.absoluteString, "width": Int(size.width), "height": Int(size.height)]
        }
        images.append(image)
      }
      controller.dismiss(animated: true) { self.completion(.success(images)) }
    } catch {
      controller.dismiss(animated: true) { self.completion(.failure(error)) }
    }
  }

  func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
    controller.dismiss(animated: true) { self.completion(.success(nil)) }
  }

  func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
    controller.dismiss(animated: true) { self.completion(.failure(error)) }
  }
}
