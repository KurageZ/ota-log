import UIKit
import AVFoundation
import Vision

final class ChekiCameraController: UIViewController, AVCaptureVideoDataOutputSampleBufferDelegate, AVCapturePhotoCaptureDelegate {
  var onComplete: ((Result<String?, Error>) -> Void)?
  private let session = AVCaptureSession()
  private let queue = DispatchQueue(label: "com.otalog.cheki-camera", qos: .userInitiated)
  private let video = AVCaptureVideoDataOutput()
  private let photo = AVCapturePhotoOutput()
  private let preview = AVCaptureVideoPreviewLayer()
  private let outline = CAShapeLayer()
  private let outlineShadow = CAShapeLayer()
  private let previewView = UIView()
  private let status = UILabel()
  private let shutter = UIButton(type: .system)
  private let close = UIButton(type: .system)
  private var lastDetection = 0.0 // Accessed only on the capture queue.
  private var tracking = ChekiBoundaryTracker()
  private var displayedPoints: [CGPoint] = [] // Main thread only.
  private var frameSize = CGSize(width: 3, height: 4)
  private var capturing = false

  override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }
  override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

  override func viewDidLoad() {
    super.viewDidLoad()
    // Camera chrome is deliberately dark in both app themes for contrast over live imagery.
    view.backgroundColor = .black
    preview.session = session
    preview.videoGravity = .resizeAspect
    previewView.layer.addSublayer(preview)
    for layer in [outlineShadow, outline] {
      layer.fillColor = UIColor.clear.cgColor
      layer.lineJoin = .round
      previewView.layer.addSublayer(layer)
    }
    outlineShadow.strokeColor = UIColor.black.cgColor
    outlineShadow.lineWidth = 6
    outline.strokeColor = UIColor.white.cgColor
    outline.lineWidth = 3
    status.text = "正在启动相机…"
    status.textColor = .white
    status.font = .preferredFont(forTextStyle: .body)
    status.adjustsFontForContentSizeCategory = true
    status.numberOfLines = 0
    status.textAlignment = .center
    close.setTitle("取消", for: .normal)
    close.tintColor = .white
    close.addTarget(self, action: #selector(cancel), for: .touchUpInside)
    shutter.setTitle("拍摄", for: .normal)
    shutter.titleLabel?.font = .preferredFont(forTextStyle: .headline)
    shutter.backgroundColor = .white
    shutter.tintColor = .black
    shutter.layer.cornerRadius = 28
    shutter.isEnabled = false
    shutter.addTarget(self, action: #selector(capture), for: .touchUpInside)
    for child in [previewView, status, close, shutter] {
      child.translatesAutoresizingMaskIntoConstraints = false
      view.addSubview(child)
    }
    let safe = view.safeAreaLayoutGuide
    NSLayoutConstraint.activate([
      close.topAnchor.constraint(equalTo: safe.topAnchor), close.leadingAnchor.constraint(equalTo: safe.leadingAnchor, constant: 20),
      close.heightAnchor.constraint(equalToConstant: 44), close.widthAnchor.constraint(greaterThanOrEqualToConstant: 60),
      previewView.topAnchor.constraint(equalTo: close.bottomAnchor, constant: 8),
      previewView.leadingAnchor.constraint(equalTo: safe.leadingAnchor), previewView.trailingAnchor.constraint(equalTo: safe.trailingAnchor),
      previewView.bottomAnchor.constraint(equalTo: status.topAnchor, constant: -16),
      status.leadingAnchor.constraint(equalTo: safe.leadingAnchor, constant: 24), status.trailingAnchor.constraint(equalTo: safe.trailingAnchor, constant: -24),
      status.bottomAnchor.constraint(equalTo: shutter.topAnchor, constant: -20),
      shutter.centerXAnchor.constraint(equalTo: safe.centerXAnchor), shutter.widthAnchor.constraint(equalToConstant: 112),
      shutter.heightAnchor.constraint(equalToConstant: 56), shutter.bottomAnchor.constraint(equalTo: safe.bottomAnchor, constant: -20),
    ])
    NotificationCenter.default.addObserver(self, selector: #selector(interrupted), name: AVCaptureSession.wasInterruptedNotification, object: session)
    NotificationCenter.default.addObserver(self, selector: #selector(resumed), name: AVCaptureSession.interruptionEndedNotification, object: session)
    NotificationCenter.default.addObserver(self, selector: #selector(runtimeError(_:)), name: AVCaptureSession.runtimeErrorNotification, object: session)
    queue.async { self.configure() }
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    preview.frame = previewView.bounds
    drawBoundary()
  }

  override func viewDidDisappear(_ animated: Bool) {
    super.viewDidDisappear(animated)
    NotificationCenter.default.removeObserver(self)
    queue.async {
      self.video.setSampleBufferDelegate(nil, queue: nil)
      self.session.stopRunning()
    }
  }

  private func configure() {
    do {
      guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else {
        throw NSError(domain: "ChekiCamera", code: 1, userInfo: [NSLocalizedDescriptionKey: "请允许相机权限后重试。"])
      }
      guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
        throw NSError(domain: "ChekiCamera", code: 2, userInfo: [NSLocalizedDescriptionKey: "此设备没有可用的后置相机，请使用 iPhone 真机或从相册选图。"])
      }
      let input = try AVCaptureDeviceInput(device: camera)
      session.beginConfiguration()
      session.sessionPreset = .photo
      guard session.canAddInput(input), session.canAddOutput(video), session.canAddOutput(photo) else {
        session.commitConfiguration()
        throw NSError(domain: "ChekiCamera", code: 3, userInfo: [NSLocalizedDescriptionKey: "无法配置相机，请关闭其他相机应用后重试。"])
      }
      session.addInput(input)
      session.addOutput(video)
      session.addOutput(photo)
      video.alwaysDiscardsLateVideoFrames = true
      video.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarFullRange]
      video.setSampleBufferDelegate(self, queue: queue)
      // Rotate both buffers and preview identically; Vision sees upright pixels (.up).
      video.connection(with: .video)?.videoRotationAngle = 90
      photo.connection(with: .video)?.videoRotationAngle = 90
      session.commitConfiguration()
      DispatchQueue.main.async { self.preview.connection?.videoRotationAngle = 90 }
      session.startRunning()
      DispatchQueue.main.async {
        self.shutter.isEnabled = true
        self.status.text = "对准完整相纸，露出四个角"
      }
    } catch {
      DispatchQueue.main.async { self.finish(.failure(error)) }
    }
  }

  func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    let now = CACurrentMediaTime()
    guard now - lastDetection >= 0.2, let buffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
    lastDetection = now
    let request = VNDetectRectanglesRequest()
    request.maximumObservations = 6
    request.minimumConfidence = 0.5
    request.minimumAspectRatio = 0.3
    request.minimumSize = 0.15
    request.quadratureTolerance = 45
    do {
      try VNImageRequestHandler(cvPixelBuffer: buffer, orientation: .up).perform([request])
      let best = request.results?.max { $0.boundingBox.width * $0.boundingBox.height < $1.boundingBox.width * $1.boundingBox.height }
      let points = best.map { [$0.topLeft, $0.topRight, $0.bottomRight, $0.bottomLeft].map { CGPoint(x: $0.x, y: 1 - $0.y) } } ?? []
      let tracked = tracking.update(points)
      let size = CGSize(width: CVPixelBufferGetWidth(buffer), height: CVPixelBufferGetHeight(buffer))
      DispatchQueue.main.async {
        guard !self.capturing, self.onComplete != nil else { return }
        self.frameSize = size
        self.displayedPoints = tracked.points
        self.outline.strokeColor = (tracked.stable ? UIColor.systemGreen : UIColor.white).cgColor
        self.status.text = tracked.stable ? "边框已稳定，可以拍摄" : points.isEmpty ? "对准完整相纸，露出四个角" : "已找到边框，请保持稳定"
        self.drawBoundary()
      }
    } catch {
      DispatchQueue.main.async { self.finish(.failure(error)) }
    }
  }

  private func drawBoundary() {
    let rect = AVMakeRect(aspectRatio: frameSize, insideRect: previewView.bounds)
    let path = UIBezierPath()
    for (index, point) in displayedPoints.enumerated() {
      let screenPoint = CGPoint(x: rect.minX + point.x * rect.width, y: rect.minY + point.y * rect.height)
      if index == 0 { path.move(to: screenPoint) } else { path.addLine(to: screenPoint) }
    }
    path.close()
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    outline.path = path.cgPath
    outlineShadow.path = path.cgPath
    CATransaction.commit()
  }

  @objc private func capture() {
    capturing = true
    shutter.isEnabled = false
    close.isEnabled = false
    status.text = "正在拍摄…"
    queue.async {
      self.photo.capturePhoto(with: AVCapturePhotoSettings(), delegate: self)
    }
  }

  func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
    do {
      if let error { throw error }
      guard let data = photo.fileDataRepresentation() else { throw ChekiCropError.unreadableImage }
      let url = FileManager.default.temporaryDirectory.appendingPathComponent("cheki-camera-\(UUID().uuidString).jpg")
      try data.write(to: url)
      DispatchQueue.main.async { self.finish(.success(url.absoluteString)) }
    } catch {
      DispatchQueue.main.async { self.finish(.failure(error)) }
    }
  }

  @objc private func cancel() { finish(.success(nil)) }

  func photoOutput(_ output: AVCapturePhotoOutput, didFinishCaptureFor resolvedSettings: AVCaptureResolvedPhotoSettings, error: Error?) {
    if let error {
      DispatchQueue.main.async { self.finish(.failure(error)) }
    }
  }

  @objc private func interrupted() {
    DispatchQueue.main.async {
      if self.capturing {
        self.finish(.failure(NSError(domain: "ChekiCamera", code: 4, userInfo: [NSLocalizedDescriptionKey: "拍摄被中断，请重试。"])))
        return
      }
      self.displayedPoints = []
      self.drawBoundary()
      self.shutter.isEnabled = false
      self.status.text = "相机暂时不可用，请返回后重试"
    }
  }

  @objc private func resumed() {
    DispatchQueue.main.async {
      self.shutter.isEnabled = !self.capturing
      self.status.text = "对准完整相纸，露出四个角"
    }
    queue.async { self.tracking = ChekiBoundaryTracker() }
  }

  @objc private func runtimeError(_ notification: Notification) {
    let error = notification.userInfo![AVCaptureSessionErrorKey] as! Error
    DispatchQueue.main.async { self.finish(.failure(error)) }
  }

  private func finish(_ result: Result<String?, Error>) {
    guard let completion = onComplete else { return }
    onComplete = nil
    dismiss(animated: true) { completion(result) }
  }
}
