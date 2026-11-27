export function driveVehicleKey(owner: string, live: boolean) {
  return 'drive-vehicle.v1.' + (live ? 'live.' : 'preview.') + owner;
}

export function resolveDriveVehicle(cars: readonly { id: string }[], saved: string | null) {
  if (saved && cars.some(car => car.id === saved)) return saved;
  return cars.length === 1 ? cars[0].id : null;
}
