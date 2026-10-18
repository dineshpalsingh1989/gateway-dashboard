export const menuKeyboard={keyboard:[['/devices','/latest'],['/status','/system'],['/help','/whoami']],resize_keyboard:true}
export function sensorCommand(text,ctx){
  const command=text.trim().split(/\s/)[0].split('@')[0].toLowerCase()
  if(command==='/help'||command==='/menu')return 'Choose a button:\n/devices — list sensors\n/latest — latest readings\n/status — last seen and battery\n/system — server resources (owner only)\n/whoami — account details\n/signout — sign out'
  if(!['/devices','/latest','/status'].includes(command))return null
  if(!ctx.devices.length)return 'No devices have reported to this workspace yet.'
  return ctx.devices.map(d=>{
    if(command==='/devices')return d.name+' ('+d.model+') — '+(d.eui||'unknown EUI')
    if(command==='/status')return d.name+'\nLast seen: '+(d.lastSeen||'never')+'\nBattery: '+(d.readings.battery?.now??'unknown')
    return d.name+'\n'+Object.entries(d.readings).map(([k,v])=>k+': '+v.now).join('\n')
  }).join('\n\n')
}
