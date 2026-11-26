"""Generate the US garage picker from the FuelEconomy.gov vehicle export."""
import csv
import io
import json
from pathlib import Path
import urllib.request
import zipfile

URL = 'https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip'
makers = {'Aston Martin', 'Bugatti', 'Bugatti Rimac', 'Ferrari', 'Koenigsegg', 'Lamborghini',
          'Lotus', 'McLaren Automotive', 'Pagani', 'Saleen Performance', 'Spyker', 'Vector'}
special = {'Audi': ('R8',), 'Ford': ('GT',), 'Acura': ('NSX',), 'Honda': ('NSX',),
           'Lexus': ('LFA',), 'Porsche': ('911', 'Carrera GT', '918 Spyder'),
           'Mercedes-Benz': ('AMG GT', 'SLS', 'SLR'), 'Dodge': ('Viper',), 'SRT': ('Viper',),
           'BMW': ('i8',), 'Chevrolet': ('Corvette',), 'Maserati': ('MC20','MC12')}
rows = []
with urllib.request.urlopen(URL,timeout=45) as response:
    archive = zipfile.ZipFile(io.BytesIO(response.read()))
with archive.open('vehicles.csv') as data:
    for car in csv.DictReader(io.TextIOWrapper(data,encoding='utf-8-sig')):
        make, model, year = car['make'], car['model'], int(car['year'])
        base = car['baseModel'] or model
        if make not in makers and not any(base == m or model == m or model.startswith(m+' ') for m in special.get(make,())):
            continue
        if base in ('Urus','DBX','Purosangue','Eletre','Emeya') or model.startswith(('DBX','Urus','Purosangue')):
            continue
        make = {'McLaren Automotive':'McLaren','Bugatti Rimac':'Rimac' if base=='Nevera' else 'Bugatti', 'Saleen Performance':'Saleen'}.get(make,make)
        engine = (car['displ']+' L / '+car['cylinders']+' cylinders') if car['cylinders'] and car['displ'] else car['fuelType1']
        gearbox = car['trany']
        if year==2010 and base=='R8':
            engine = car['displ']+' L '+('V10' if car['cylinders']=='10' else 'V8')
            gearbox = {'Automatic (AM6)':'R tronic','Manual 6-spd':'6-speed manual'}.get(gearbox,gearbox)
        trim = ' · '.join(v for v in (model if model!=base else '',engine,gearbox,car['drive']) if v)
        rows.append((year,make,base,trim,engine,car['drive'],gearbox,car['id']))
# The EPA groups the STO with other Huracan configurations. Keep its manufacturer record distinct.
for year in (2022,2023,2024):
    rows.append((year,'Lamborghini','Huracan','STO','5.2 L V10','Rear-wheel drive','7-speed dual-clutch','STO'))
unique = {}
for row in sorted(rows):
    unique.setdefault(row[:4],row)
path = Path(__file__).resolve().parents[1]/'apps/mobile/src/data/garage-models.json'
path.write_text(json.dumps(list(unique.values()),ensure_ascii=True,separators=(',',':')),encoding='utf-8')
print(len(unique),'configurations',len({r[1] for r in unique}),'makes',min(r[0] for r in unique),max(r[0] for r in unique))
