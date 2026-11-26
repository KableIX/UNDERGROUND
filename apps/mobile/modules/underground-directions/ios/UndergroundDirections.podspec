Pod::Spec.new do |s|
  s.name = 'UndergroundDirections'
  s.version = '1.0.0'
  s.summary = 'Driving directions to the start of an UNDERGROUND route.'
  s.homepage = 'https://theunderground.vip'
  s.license = 'Proprietary'
  s.author = 'UNDERGROUND'
  s.source = { :git => '' }
  s.platform = :ios, '15.1'
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'MapKit', 'AVFoundation'
  s.source_files = '*.swift'
end
