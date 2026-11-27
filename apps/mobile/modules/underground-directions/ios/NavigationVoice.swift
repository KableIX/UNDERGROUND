import AVFoundation

// All playback and session operations run on the main queue.
final class NavigationVoice: NSObject, AVSpeechSynthesizerDelegate {
  private lazy var synthesizer: AVSpeechSynthesizer = {
    let synth = AVSpeechSynthesizer()
    synth.usesApplicationAudioSession = true
    synth.delegate = self
    return synth
  }()
  private var current: AVSpeechUtterance?
  private var ownsSession = false

  func speak(_ text: String, voiceIdentifier: String?) throws {
    let utterance = AVSpeechUtterance(string: text)
    guard let id = voiceIdentifier, let chosen = AVSpeechSynthesisVoice(identifier: id) else {
      throw NSError(domain: "UndergroundVoice", code: 1)
    }
    utterance.voice = chosen
    utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.98

    let session = AVAudioSession.sharedInstance()
    if !ownsSession {
      try session.setCategory(.playback, mode: .voicePrompt, options: [.duckOthers, .interruptSpokenAudioAndMixWithOthers])
      try session.setActive(true)
      ownsSession = true
    }
    // A cancellation callback may arrive after its replacement starts.
    let replacing = current != nil
    current = utterance
    if replacing { synthesizer.stopSpeaking(at: .immediate) }
    synthesizer.speak(utterance)
  }

  func stop() {
    if current != nil {
      current = nil
      synthesizer.stopSpeaking(at: .immediate)
    }
    releaseSession()
  }

  private func releaseSession() {
    guard ownsSession else { return }
    ownsSession = false
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  private func complete(_ utterance: AVSpeechUtterance) {
    guard current === utterance else { return }
    current = nil
    releaseSession()
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    complete(utterance)
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
    complete(utterance)
  }
}
