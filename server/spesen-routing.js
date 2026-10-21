// Privacy boundary: never persist origin, destination, search text or geometry.
export function koordinaten(wert){
 if(!Array.isArray(wert)||wert.length!==2||!wert.every(n=>typeof n==='number'&&Number.isFinite(n))||Math.abs(wert[0])>180||Math.abs(wert[1])>85)throw new Error('EINGABE');
 // Restrict to the practical European travel area, not a general worldwide proxy.
 if(wert[0]<-12||wert[0]>35||wert[1]<34||wert[1]>72)throw new Error('GEBIET');
 return wert;
}
async function provider(url,options={}){
 const response=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error(response.status===429?'KONTINGENT':'PROVIDER');
 const data=await response.json();return data;
}
export async function sucheOrte(text,key){
 if(typeof text!=='string'||text.trim().length<4||text.length>180)throw new Error('EINGABE');
 const url=new URL('https://api.openrouteservice.org/geocode/search');
 url.searchParams.set('text',text.trim());url.searchParams.set('size','5');url.searchParams.set('boundary.country','DE');
 const data=await provider(url,{headers:{Authorization:key}});
 return (data.features||[]).slice(0,5).flatMap(f=>{try{return [{label:String(f.properties?.label||'Ort').slice(0,240),koordinaten:koordinaten(f.geometry?.coordinates)}];}catch{return [];}});
}
export async function berechneRoute(start,ziel,key){
 koordinaten(start);koordinaten(ziel);
 // Separate one-way requests: a reversed route need not have equal distance.
 const fahre=async(von,nach)=>{
  const data=await provider('https://api.openrouteservice.org/v2/directions/driving-car/geojson',{
   method:'POST',headers:{Authorization:key,'Content-Type':'application/json'},
   body:JSON.stringify({coordinates:[von,nach],preference:'shortest',instructions:false,units:'m'}),
  });
  const f=data.features?.[0],meter=f?.properties?.summary?.distance,linie=f?.geometry?.coordinates;
  if(!Number.isFinite(meter)||meter<0||meter>1500000||!Array.isArray(linie)||linie.length>150000)throw new Error('PROVIDER');
  return {meter,linie:linie.map(koordinaten)};
 };
 const hin=await fahre(start,ziel),zurueck=await fahre(ziel,start);
 return {hin,zurueck,kilometer:(hin.meter+zurueck.meter)/1000,quelle:'openrouteservice · shortest · OpenStreetMap',berechnet_am:new Date().toISOString()};
}
