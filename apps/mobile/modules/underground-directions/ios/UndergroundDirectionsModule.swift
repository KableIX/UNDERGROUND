import ExpoModulesCore
import MapKit

public final class UndergroundDirectionsModule: Module {
  private let voice = NavigationVoice()

  public func definition() -> ModuleDefinition {
    Name("UndergroundDirections")
    AsyncFunction("speakNavigationPrompt") { (text: String, voiceIdentifier: String?) in
      try self.voice.speak(text, voiceIdentifier: voiceIdentifier)
    }.runOnQueue(.main)
    AsyncFunction("stopNavigationPrompt") {
      self.voice.stop()
    }.runOnQueue(.main)
    OnDestroy {
      let voice = self.voice
      DispatchQueue.main.async { voice.stop() }
    }
    AsyncFunction("driveToStart") { (fromLat: Double, fromLon: Double, toLat: Double, toLon: Double, promise: Promise) in
      let request = MKDirections.Request()
      request.source = MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: fromLat, longitude: fromLon)))
      request.destination = MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: toLat, longitude: toLon)))
      request.transportType = .automobile
      MKDirections(request: request).calculate { response, error in
        guard let route = response?.routes.first else {
          promise.reject("NO_DRIVING_ROUTE", error?.localizedDescription ?? "No driving route to the start.")
          return
        }
        var points = [[Double]]()
        var turns = [[String: Any]]()
        for step in route.steps {
          let line = step.polyline
          guard line.pointCount > 1 else { continue }
          let first = line.points()[0].coordinate
          let sharesStart = points.last == [first.longitude, first.latitude]
          let index = sharesStart ? points.count - 1 : points.count
          if !step.instructions.isEmpty {
            turns.append(["index": index, "instruction": step.instructions])
          }
          for i in (sharesStart ? 1 : 0)..<line.pointCount {
            let c = line.points()[i].coordinate
            points.append([c.longitude, c.latitude])
          }
        }
        guard points.count >= 2 else {
          promise.reject("EMPTY_DRIVING_ROUTE", "No road geometry for this approach.")
          return
        }
        promise.resolve(["points": points, "turns": turns])
      }
    }.runOnQueue(.main)
  }
}
