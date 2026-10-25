import { denyUpstream } from '@/lib/rate-limit';
export async function GET(request:Request){
 const denied = await denyUpstream(request); if (denied) return denied;
 const q=new URL(request.url).searchParams,address=q.get('address')||'',month=q.get('month')||'';
 if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return Response.json({error:'Invalid wallet or month'},{status:400});
 const base='https://portfolio.datapi.meteora.ag';
 async function get(path:string){for(let i=0;i<3;i++){const r=await fetch(base+path,{signal:AbortSignal.timeout(20000)});if((r.status===429||r.status>=500)&&i<2){await new Promise(r=>setTimeout(r,1000*(i+1)));continue}if(!r.ok)throw new Error(`Meteora returned ${r.status}`);return r.json() as Promise<Record<string,unknown>>}throw new Error('Meteora unavailable')}
 const [p,c]=await Promise.allSettled([get(`/performances/${address}?time_range=30d`),get(`/chart/calendar/${address}?month=${month}`)]);
 const performance=p.status==='fulfilled'?p.value:undefined,calendar=c.status==='fulfilled'?c.value:undefined;
 const errors=[p.status==='rejected'?'Performance: '+p.reason.message:null,c.status==='rejected'?'Calendar: '+c.reason.message:null,performance&&typeof performance.avg_invested_usd==='undefined'?'Performance data unavailable':null,calendar&&!Array.isArray(calendar.data_points)?'Calendar data unavailable':null].filter(Boolean);
 return Response.json({performance,days:calendar?.data_points,error:errors.length?errors.join('; '):undefined,fetchedAt:new Date().toISOString()},{headers:{'Cache-Control':'private, max-age=300'}});
}
