import ExpoModulesCore
import VisionKit

public class ChekiCropModule: Module {
  private var scanner: ChekiDocumentScanner?

  public func definition() -> ModuleDefinition {
    Name("ChekiCrop")

    AsyncFunction("scanDocuments") { (promise: Promise) in
      guard VNDocumentCameraViewController.isSupported else {
        promise.reject("ERR_SCANNER_UNSUPPORTED", "此设备不支持系统文档扫描，请使用支持的 iPhone 或 iPad。")
        return
      }
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject("ERR_CAMERA_PRESENTATION", "无法打开扫描相机。")
        return
      }
      let scanner = ChekiDocumentScanner { [weak self] result in
        self?.scanner = nil
        switch result {
        case .success(let images): promise.resolve(images)
        case .failure(let error): promise.reject("ERR_CHEKI_SCAN", error.localizedDescription)
        }
      }
      self.scanner = scanner
      let camera = VNDocumentCameraViewController()
      camera.delegate = scanner
      camera.modalPresentationStyle = .fullScreen
      presenter.present(camera, animated: true)
    }.runOnQueue(.main)

    AsyncFunction("whiteBalance") { (uri: String, x: Double, y: Double, strength: Double) in
      try ChekiWhiteBalanceProcessor.adjust(uri: uri, x: x, y: y, strength: strength)
    }

    AsyncFunction("detect") { (uri: String) in
      try ChekiCropProcessor.detect(uri: uri)
    }

    AsyncFunction("crop") { (uri: String, corners: [Double]) in
      try ChekiCropProcessor.crop(uri: uri, corners: corners)
    }
  }
}
