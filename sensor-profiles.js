// Additional models use the gateway's official payload codec (decoded JSON).
export const EXTRA_PROFILES = {
  'em300-sld': { short:'EM300-SLD', label:'Milesight EM300-SLD (Spot Leak)', metrics:['leak','battery'] },
  'em300-zld': { short:'EM300-ZLD', label:'Milesight EM300-ZLD (Zone Leak)', metrics:['leak','battery'] },
  'em300-mld': { short:'EM300-MLD', label:'Milesight EM300-MLD (Membrane Leak)', metrics:['leak','battery'] },
  'em300-di': { short:'EM300-DI', label:'Milesight EM300-DI (Pulse Counter)', metrics:['pulse','battery'] },
  'em400-udl': { short:'EM400-UDL', label:'Milesight EM400-UDL (Distance)', metrics:['distance','battery'] },
  'em500-swl': { short:'EM500-SWL', label:'Milesight EM500-SWL (Water Level)', metrics:['water_level','battery'] },
  'em500-smtc': { short:'EM500-SMTC', label:'Milesight EM500-SMTC (Soil)', metrics:['temperature','moisture','ec','battery'] },
  'em500-pp': { short:'EM500-PP', label:'Milesight EM500-PP (Pipe Pressure)', metrics:['pressure','battery'] },
  'ct101': { short:'CT101', label:'Milesight CT101 (Current)', metrics:['current'] },
  'ct103': { short:'CT103', label:'Milesight CT103 (Current)', metrics:['current'] },
  'ct301': { short:'CT301', label:'Milesight CT301 (Three-phase Current)', metrics:['current_1','current_2','current_3'] },
  'vs133': { short:'VS133', label:'Milesight VS133 (People Counting)', metrics:['total_in','total_out'] },
  'vs125': { short:'VS125', label:'Milesight VS125 (People Counting)', metrics:['total_in','total_out'] },
  'ts301': { short:'TS301', label:'Milesight TS301 (Temperature)', metrics:['temperature','battery'] },
  'ts302': { short:'TS302', label:'Milesight TS302 (Dual Temperature)', metrics:['temperature','temperature_2','battery'] },
  'em320-tilt': { short:'EM320-TILT', label:'Milesight EM320-TILT (Tilt)', metrics:['angle_x','angle_y','angle_z','battery'] },
  'wts506': { short:'WTS506', label:'Milesight WTS506 (Weather)', metrics:['temperature','humidity','wind_speed','wind_direction','rainfall','pressure'] },
}

export const EXTRA_META = {
  leak:{u:'',bool:1,n:'Leak detected'}, pulse:{u:'pulses',dp:0,n:'Pulse count'},
  distance:{u:'mm',dp:0,n:'Distance'}, water_level:{u:'cm',dp:1,n:'Water level'},
  moisture:{u:'%',dp:1,n:'Soil moisture'}, ec:{u:'µS/cm',dp:0,n:'Conductivity'},
  current_1:{u:'A',dp:2,n:'Phase 1 current'}, current_2:{u:'A',dp:2,n:'Phase 2 current'}, current_3:{u:'A',dp:2,n:'Phase 3 current'},
  total_in:{u:'people',dp:0,n:'Total entries'},total_out:{u:'people',dp:0,n:'Total exits'},
  angle_x:{u:'°',dp:1,n:'X angle'},angle_y:{u:'°',dp:1,n:'Y angle'},angle_z:{u:'°',dp:1,n:'Z angle'},
  wind_speed:{u:'m/s',dp:1,n:'Wind speed'},wind_direction:{u:'°',dp:0,n:'Wind direction'},rainfall:{u:'mm',dp:1,n:'Rainfall'},
}
