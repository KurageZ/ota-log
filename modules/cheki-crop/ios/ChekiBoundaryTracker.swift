import Foundation

// Runs only on the serial capture queue. All points use normalized top-left coordinates.
struct ChekiBoundaryTracker {
  private var previous: [CGPoint] = []
  private var smoothed: [CGPoint] = []
  private var stableFrames = 0

  mutating func update(_ points: [CGPoint]) -> (points: [CGPoint], stable: Bool) {
    guard !points.isEmpty else {
      previous = []
      smoothed = []
      stableFrames = 0
      return ([], false)
    }
    let steady = previous.count == points.count && zip(previous, points).allSatisfy {
      hypot($0.x - $1.x, $0.y - $1.y) < 0.025
    }
    stableFrames = steady ? stableFrames + 1 : 1
    smoothed = steady ? zip(smoothed, points).map {
      CGPoint(x: $0.x * 0.65 + $1.x * 0.35, y: $0.y * 0.65 + $1.y * 0.35)
    } : points
    previous = points
    return (smoothed, stableFrames >= 3)
  }
}
