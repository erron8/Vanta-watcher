import json,urllib.request,concurrent.futures,time,datetime,csv
p='public/data/wallets.json';data=json.load(open(p));month='2026-09'
def get(path):
 for i in range(3):
  try:
   with urllib.request.urlopen('https://portfolio.datapi.meteora.ag'+path,timeout=25) as r:return json.load(r)
  except Exception:
   if i==2:raise
   time.sleep(2*(i+1))
def run(w):
 a=w['address'];errs=[]
 for key,path in [('performance',f'/performances/{a}?time_range=30d'),('days',f'/chart/calendar/{a}?month={month}')]:
  try:
   v=get(path);w[key]=v['data_points'] if key=='days' else v
  except Exception as e:errs.append(str(e))
 if errs:w['error']='; '.join(errs)
 w['fetchedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();return w
out=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
 for w in ex.map(run,data['wallets']):
  out.append(w)
  if len(out)%50==0:print(f'Checked {len(out)}/{len(data["wallets"])}',flush=True)
data.update(wallets=out,month=month)
json.dump(data,open(p,'w'))
print('Complete',len(out),'errors',sum(bool(w.get('error')) for w in out),flush=True)
