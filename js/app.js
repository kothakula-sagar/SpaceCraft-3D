const $ = id => document.getElementById(id);

const ROOM_TYPES = {
  office:{label:"Office",emoji:"💼",default:[30,24],categories:["office","all"]},
  home:{label:"Home",emoji:"🏠",default:[36,28],categories:["living","bedroom","dining","storage"]},
  kitchen:{label:"Kitchen",emoji:"🍳",default:[24,18],categories:["kitchen"]},
  bedroom:{label:"Bedroom",emoji:"🛏️",default:[20,16],categories:["bedroom","storage"]},
  living:{label:"Living Room",emoji:"🛋️",default:[26,20],categories:["living","decor"]},
  meeting:{label:"Meeting Room",emoji:"🤝",default:[28,20],categories:["office","meeting"]},
  retail:{label:"Retail",emoji:"🛍️",default:[36,24],categories:["retail","storage"]},
  restaurant:{label:"Restaurant",emoji:"🍽️",default:[42,28],categories:["dining","kitchen"]}
};

const LIBRARY = [
  {id:"desk",name:"Desk",cat:"office",icon:"🖥️",size:[5,2.5],kind:"desk"},
  {id:"executiveDesk",name:"Executive Desk",cat:"office",icon:"🗄️",size:[7,3],kind:"executiveDesk"},
  {id:"officeChair",name:"Office Chair",cat:"office",icon:"🪑",size:[2,2],kind:"chair"},
  {id:"meetingTable",name:"Meeting Table",cat:"meeting",icon:"◯",size:[8,3.5],kind:"meetingTable"},
  {id:"meetingChair",name:"Meeting Chair",cat:"meeting",icon:"💺",size:[2,2],kind:"chair"},
  {id:"sofa",name:"Sofa",cat:"living",icon:"🛋️",size:[6,2.6],kind:"sofa"},
  {id:"coffee",name:"Coffee Table",cat:"living",icon:"☕",size:[4,2],kind:"table"},
  {id:"tv",name:"TV Console",cat:"living",icon:"📺",size:[6,1.4],kind:"tv"},
  {id:"bed",name:"Bed",cat:"bedroom",icon:"🛏️",size:[6.5,6],kind:"bed"},
  {id:"nightstand",name:"Nightstand",cat:"bedroom",icon:"🗃️",size:[1.8,1.8],kind:"cabinet"},
  {id:"wardrobe",name:"Wardrobe",cat:"storage",icon:"🚪",size:[5,2],kind:"wardrobe"},
  {id:"cabinet",name:"Cabinet",cat:"storage",icon:"🗄️",size:[3,1.5],kind:"cabinet"},
  {id:"bookshelf",name:"Bookshelf",cat:"storage",icon:"📚",size:[3.5,1.2],kind:"bookshelf"},
  {id:"kitchenIsland",name:"Kitchen Island",cat:"kitchen",icon:"🍳",size:[7,3],kind:"island"},
  {id:"counter",name:"Kitchen Counter",cat:"kitchen",icon:"🧱",size:[7,2],kind:"counter"},
  {id:"fridge",name:"Refrigerator",cat:"kitchen",icon:"🧊",size:[2.8,2.8],kind:"fridge"},
  {id:"stove",name:"Cooktop",cat:"kitchen",icon:"🔥",size:[3,2],kind:"stove"},
  {id:"diningTable",name:"Dining Table",cat:"dining",icon:"🍽️",size:[6,3],kind:"diningTable"},
  {id:"diningChair",name:"Dining Chair",cat:"dining",icon:"🪑",size:[1.8,1.8],kind:"chair"},
  {id:"plant",name:"Plant",cat:"decor",icon:"🪴",size:[1.4,1.4],kind:"plant"},
  {id:"lamp",name:"Floor Lamp",cat:"decor",icon:"💡",size:[1.2,1.2],kind:"lamp"},
  {id:"rug",name:"Area Rug",cat:"decor",icon:"▧",size:[7,5],kind:"rug"},
  {id:"shelf",name:"Retail Shelf",cat:"retail",icon:"🛒",size:[5,1.5],kind:"shelf"},
  {id:"checkout",name:"Checkout Counter",cat:"retail",icon:"💳",size:[6,2],kind:"checkout"},
  {id:"barTable",name:"Restaurant Table",cat:"dining",icon:"◯",size:[4,4],kind:"diningTable"}
];

const THEMES = {
  Warm:["#f4eadb","#bca78b","#8c6746"],
  Modern:["#e7ebef","#747d87","#303844"],
  Sage:["#e5eadf","#aebaa1","#718264"],
  Coastal:["#e4f1f4","#a9c5c9","#6e8e92"],
  Midnight:["#29313b","#4b5360","#d1a15d"]
};

let state = {
  roomType:"office", L:30, W:24,
  colors:{wall:"#f4f0e8",floor:"#c8bda9",furniture:"#8c6746"},
  objects:[], selectedId:null, grid:true, snap:true, walls:true
};
let history=[], historyIndex=-1;
let scene, camera, renderer, roomGroup, objectGroup, gridHelper, selectedBox;
let selected=null, raycaster=new THREE.Raycaster(), mouse=new THREE.Vector2();
let plane=new THREE.Plane(new THREE.Vector3(0,1,0),0), hit=new THREE.Vector3();
let drag=null, cameraMode="3d", theta=.65, phi=.62, distance=52, target=new THREE.Vector3();
let materials={};

function mat(color,rough=.72){return new THREE.MeshStandardMaterial({color,roughness:rough})}
function buildMaterials(){materials={
 wall:mat(state.colors.wall,.95), floor:mat(state.colors.floor,.8), furniture:mat(state.colors.furniture,.58),
 accent:mat("#667085",.5), dark:mat("#1b222c",.3), fabric:mat("#5e7782",.9),
 glass:new THREE.MeshStandardMaterial({color:"#9bd5df",transparent:true,opacity:.42,roughness:.2}),
 green:mat("#4c7d55",.95), white:mat("#f4f4ef",.7)
}}

function box(g,w,h,d,m,x,y,z){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o}
function cyl(g,r,h,m,x,y,z){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o}
function makeObject(def){
  const g=new THREE.Group(), k=def.kind;
  const wood=materials.furniture, metal=materials.dark, fabric=materials.fabric;
  if(k==="desk"||k==="executiveDesk"){const w=k==="desk"?5:7,d=k==="desk"?2.5:3;box(g,w,.18,d,wood,0,2.45,0);[-w/2+.15,w/2-.15].forEach(x=>box(g,.16,2.4,.16,metal,x,1.2,0));box(g,w*.42,1.0,.08,metal,0,3.45,-d/2+.12);box(g,1.2,.05,.5,metal,0,2.55,.2)}
  else if(k==="chair"){box(g,1.7,.18,1.7,fabric,0,1.55,0);box(g,1.7,1.55,.18,fabric,0,2.35,-.75);cyl(g,.1,1.45,metal,0,.7,0);box(g,1.7,.08,.18,metal,0,.08,0)}
  else if(k==="sofa"){box(g,6,1.1,2.5,fabric,0,.75,0);box(g,6,1.55,.65,fabric,0,1.9,-.92);box(g,.45,1.1,2.5,fabric,-2.78,1.5,0);box(g,.45,1.1,2.5,fabric,2.78,1.5,0)}
  else if(k==="coffee"||k==="diningTable"||k==="barTable"){const s=k==="coffee"?[4,2]:k==="diningTable"?[6,3]:[4,4];box(g,s[0],.18,s[1],wood,0,2.0,0);box(g,.25,1.9,.25,metal,-s[0]/2+.35,1, -s[1]/2+.35);box(g,.25,1.9,.25,metal,s[0]/2-.35,1,-s[1]/2+.35);box(g,.25,1.9,.25,metal,-s[0]/2+.35,1,s[1]/2-.35);box(g,.25,1.9,.25,metal,s[0]/2-.35,1,s[1]/2-.35)}
  else if(k==="meetingTable"){box(g,8,.2,3.5,wood,0,2.1,0);box(g,.35,2,.3,metal,-3,1,0);box(g,.35,2,.3,metal,3,1,0)}
  else if(k==="tv"){box(g,6,1.2,1.4,wood,0,.6,0);box(g,5.4,3,.18,metal,0,3.0,.2)}
  else if(k==="bed"){box(g,6.5,.55,6,wood,0,.5,0);box(g,6.1,.45,5.6,white,0,.95,0);box(g,6.1,2.2,.35,fabric,0,1.65,-2.7);box(g,2.3,.35,1.6,white,-1.7,1.45,-2)}
  else if(k==="wardrobe"){box(g,5,6.2,2,wood,0,3.1,0);box(g,.06,5.7,.03,metal,0,3.1,1.02);box(g,.1,.6,.08,metal,.25,3.1,1.05);box(g,.1,.6,.08,metal,-.25,3.1,1.05)}
  else if(k==="cabinet"||k==="nightstand"){const w=k==="cabinet"?3:1.8,d=k==="cabinet"?1.5:1.8;box(g,w,3.1,d,wood,0,1.55,0);for(let y=1.1;y<=2.5;y+=.7)box(g,w*.65,.08,.05,metal,0,y,d/2+.03)}
  else if(k==="bookshelf"||k==="shelf"){const w=k==="bookshelf"?3.5:5,d=k==="bookshelf"?1.2:1.5,h=k==="bookshelf"?6:5;box(g,w,h,d,wood,0,h/2,0);for(let y=1;y<h;y+=1.25)box(g,w-.2,.08,.08,metal,0,y,d/2+.03)}
  else if(k==="plant"){cyl(g,.65,1.2,materials.white,0,.6,0);[[0,2.2,0,.85],[.35,2.8,.1,.65],[-.35,2.7,-.1,.65]].forEach(s=>{const o=new THREE.Mesh(new THREE.SphereGeometry(s[3],16,12),materials.green);o.position.set(s[0],s[1],s[2]);o.castShadow=true;g.add(o)})}
  else if(k==="lamp"){cyl(g,.55,.15,metal,0,.08,0);cyl(g,.06,4,metal,0,2,0);const s=new THREE.Mesh(new THREE.ConeGeometry(.75,.85,24),new THREE.MeshStandardMaterial({color:"#ffe7ad",emissive:"#ffc75e",emissiveIntensity:.65}));s.position.y=4.3;g.add(s)}
  else if(k==="rug"){box(g,def.size[0],.04,def.size[1],new THREE.MeshStandardMaterial({color:"#8d758e",roughness:1}),0,.03,0)}
  else if(k==="kitchenIsland"||k==="counter"){const w=def.size[0],d=def.size[1];box(g,w,2.3,d,wood,0,1.15,0);box(g,w-.25,.12,d-.25,materials.white,0,2.35,0)}
  else if(k==="fridge"){box(g,2.8,6.5,2.8,materials.white,0,3.25,0);box(g,.08,5.7,.08,metal,0,3.25,1.45)}
  else if(k==="stove"){box(g,3,2.2,2,wood,0,1.1,0);[[-.7,-.45],[.7,-.45],[-.7,.45],[.7,.45]].forEach(p=>cyl(g,.28,.05,metal,p[0],2.25,p[1]))}
  else if(k==="checkout"){box(g,6,2.2,2,wood,0,1.1,0);box(g,2,.15,1.5,materials.white,0,2.3,.1)}
  else {box(g,def.size[0],1,def.size[1],wood,0,.5,0)}
  g.userData={defId:def.id,name:def.name,size:def.size};
  return g;
}

function init(){
  const host=$("viewport");
  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;host.appendChild(renderer.domElement);
  scene=new THREE.Scene();scene.background=new THREE.Color("#eef3f8");
  camera=new THREE.PerspectiveCamera(45,1,.1,700);
  scene.add(new THREE.HemisphereLight(0xffffff,0x4c5663,1.1));
  const sun=new THREE.DirectionalLight(0xffffff,.8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);
  roomGroup=new THREE.Group();objectGroup=new THREE.Group();scene.add(roomGroup,objectGroup);
  buildMaterials();bindUI();renderRoom();updateCount();$("emptyState").style.display="grid";resize();animate();
}
function renderRoom(){
  while(roomGroup.children.length)roomGroup.remove(roomGroup.children[0]);
  buildMaterials();
  box(roomGroup,state.L+.5,.3,state.W+.5,materials.floor,state.L/2,-.15,state.W/2);
  const back=box(roomGroup,state.L+.5,10,.4,materials.wall,state.L/2,5,-.2);
  const left=box(roomGroup,.4,10,state.W+.5,materials.wall,-.2,5,state.W/2);
  for(let i=0;i<Math.max(1,Math.floor(state.L/9));i++)box(roomGroup,Math.min(6,state.L/Math.max(1,Math.floor(state.L/9))-2),4.5,.05,materials.glass,(i+.5)*state.L/Math.max(1,Math.floor(state.L/9)),6,.04);
  if(!state.walls){back.visible=false;left.visible=false}
  if(gridHelper)scene.remove(gridHelper);
  gridHelper=new THREE.GridHelper(Math.max(state.L,state.W)*1.15,Math.max(state.L,state.W),0x465468,0x273342);
  gridHelper.position.set(state.L/2,0,state.W/2);gridHelper.visible=state.grid;scene.add(gridHelper);
  const s=Math.max(state.L,state.W);scene.children.find(x=>x.isDirectionalLight)?.position.set(state.L*.7,state.L+state.W,state.W*.8);
  target.set(state.L/2,2,state.W/2);distance=Math.max(state.L,state.W)*1.25+12;
}
function clearObjects(){while(objectGroup.children.length)objectGroup.remove(objectGroup.children[0]);selected=null;state.selectedId=null;removeSelectionBox()}
function addObject(defId,x=state.L/2,z=state.W/2,rotation=0,scale=1){
  const def=LIBRARY.find(d=>d.id===defId);if(!def)return;$("emptyState").style.display="none";
  const g=makeObject(def);g.position.set(x,0,z);g.rotation.y=rotation;g.scale.setScalar(scale);objectGroup.add(g);clamp(g);state.objects.push({id:crypto.randomUUID(),defId,x:g.position.x,z:g.position.z,rotation,scale});g.userData.stateId=state.objects.at(-1).id;selectObject(g);commit();updateCount();
}
function clamp(g){
  const def=LIBRARY.find(d=>d.id===g.userData.defId), sx=(def?.size?.[0]||2)*g.scale.x/2, sz=(def?.size?.[1]||2)*g.scale.z/2;
  g.position.x=Math.max(sx+.2,Math.min(state.L-sx-.2,g.position.x));g.position.z=Math.max(sz+.2,Math.min(state.W-sz-.2,g.position.z));
}
function syncObject(g){
  const s=state.objects.find(o=>o.id===g.userData.stateId);if(s){s.x=g.position.x;s.z=g.position.z;s.rotation=g.rotation.y;s.scale=g.scale.x}
}
function selectObject(g){
  selected=g;state.selectedId=g?.userData.stateId||null;
  if(selectedBox){scene.remove(selectedBox);selectedBox=null}
  if(g){selectedBox=new THREE.BoxHelper(g,0x62e6c5);scene.add(selectedBox);updateSelectionPanel()}
  else $("selectedPanel").classList.add("hidden");
}
function removeSelectionBox(){if(selectedBox){scene.remove(selectedBox);selectedBox=null}}
function updateSelectionPanel(){
  if(!selected)return;$("selectedPanel").classList.remove("hidden");$("selectedName").textContent=selected.userData.name;
  $("posX").value=selected.position.x.toFixed(2);$("posZ").value=selected.position.z.toFixed(2);
  $("scaleValue").value=selected.scale.x.toFixed(2);$("rotationValue").value=Math.round(selected.rotation.y*180/Math.PI)%360;
}
function commit(){
  const snapshot=JSON.stringify(state);history=history.slice(0,historyIndex+1);history.push(snapshot);historyIndex++;
  if(history.length>60){history.shift();historyIndex--}
  updateUndoRedo();
}
function restore(snapshot){
  state=JSON.parse(snapshot);renderRoom();clearObjects();
  state.objects.forEach(o=>{const def=LIBRARY.find(d=>d.id===o.defId);if(!def)return;const g=makeObject(def);g.position.set(o.x,0,o.z);g.rotation.y=o.rotation;g.scale.setScalar(o.scale);g.userData.stateId=o.id;objectGroup.add(g);});
  selected=state.selectedId?objectGroup.children.find(g=>g.userData.stateId===state.selectedId):null;if(selected)selectObject(selected);updateCount();syncControls();
}
function undo(){if(historyIndex>0){historyIndex--;restore(history[historyIndex]);updateUndoRedo()}}
function redo(){if(historyIndex<history.length-1){historyIndex++;restore(history[historyIndex]);updateUndoRedo()}}
function updateUndoRedo(){$("undoBtn").disabled=historyIndex<=0;$("redoBtn").disabled=historyIndex>=history.length-1}
function saveFile(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`spacecraft-${Date.now()}.json`;a.click();URL.revokeObjectURL(a.href)
}
function loadFile(file){const reader=new FileReader();reader.onload=()=>{try{state=JSON.parse(reader.result);history=[];historyIndex=-1;renderRoom();restore(JSON.stringify(state));commit()}catch(e){alert("Invalid SpaceCraft project file.")}};reader.readAsText(file)}
function loadPreset(silent=false){
  clearObjects();$("emptyState").style.display="none";
  const type=ROOM_TYPES[state.roomType]||ROOM_TYPES.office;
  const layouts={
    office:[["desk",6,5],["desk",13,5],["desk",20,5],["desk",6,12],["desk",13,12],["desk",20,12],["sofa",4,20],["coffee",4,16],["plant",2,2]],
    kitchen:[["counter",12,2],["counter",20,2],["island",12,9],["fridge",3,3],["stove",20,3],["diningTable",11,15]],
    bedroom:[["bed",10,8],["nightstand",5,8],["nightstand",15,8],["wardrobe",17,2],["rug",10,11],["lamp",3,3]],
    home:[["sofa",8,18],["coffee",8,14],["tv",8,4],["diningTable",25,20],["plant",2,2],["lamp",31,4]],
    living:[["sofa",10,15],["coffee",10,11],["tv",10,4],["plant",2,2],["lamp",23,5]],
    meeting:[["meetingTable",14,11],["meetingChair",9,6],["meetingChair",14,6],["meetingChair",19,6],["meetingChair",9,16],["meetingChair",14,16],["meetingChair",19,16],["plant",2,2]],
    retail:[["shelf",8,4],["shelf",16,4],["shelf",24,4],["shelf",8,10],["shelf",16,10],["shelf",24,10],["checkout",30,20]],
    restaurant:[["diningTable",8,7],["diningTable",20,7],["diningTable",32,7],["diningTable",8,17],["diningTable",20,17],["diningTable",32,17],["counter",38,3]]
  };
  (layouts[state.roomType]||layouts.office).forEach(([id,x,z])=>{const d=LIBRARY.find(x=>x.id===id);if(d){const g=makeObject(d);g.position.set(x,0,z);objectGroup.add(g);const item={id:crypto.randomUUID(),defId:id,x:g.position.x,z:g.position.z,rotation:0,scale:1};g.userData.stateId=item.id;state.objects.push(item);clamp(g)}});
  if(!silent)commit();updateCount();$("emptyState").style.display="none";
}
function updateCount(){$("objectCount").textContent=state.objects.length}
function syncControls(){
  $("roomLength").value=state.L;$("roomWidth").value=state.W;$("areaValue").textContent=`${(state.L*state.W).toLocaleString()} sq ft`;
  $("gridToggle").checked=state.grid;$("snapToggle").checked=state.snap;$("wallsToggle").checked=state.walls;
  $("wallColor").value=state.colors.wall;$("floorColor").value=state.colors.floor;$("furnitureColor").value=state.colors.furniture;
}
function populateRooms(){
  $("roomTypes").innerHTML="";Object.entries(ROOM_TYPES).forEach(([id,r])=>{const b=document.createElement("button");b.className="room-btn"+(id===state.roomType?" active":"");b.innerHTML=`<span class="emoji">${r.emoji}</span><strong>${r.label}</strong>`;b.onclick=()=>{state.roomType=id;document.querySelectorAll(".room-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("roomLength").value=r.default[0];$("roomWidth").value=r.default[1];updateArea()};$("roomTypes").appendChild(b)})}
let category="all";
function populateCategories(){const cats=["all","office","living","bedroom","kitchen","dining","storage","meeting","retail","decor"];$("categoryTabs").innerHTML="";cats.forEach(c=>{const b=document.createElement("button");b.textContent=c[0].toUpperCase()+c.slice(1);b.className=c===category?"active":"";b.onclick=()=>{category=c;populateLibrary()};$("categoryTabs").appendChild(b)})}
function populateLibrary(){
  const q=$("searchInput").value.toLowerCase();$("objectLibrary").innerHTML="";
  LIBRARY.filter(d=>(category==="all"||d.cat===category)&&(!q||d.name.toLowerCase().includes(q))).forEach(d=>{const b=document.createElement("button");b.className="library-item";b.innerHTML=`<span class="item-icon">${d.icon}</span><span><strong>${d.name}</strong><small>${d.cat}</small></span>`;b.onclick=()=>addObject(d.id,state.L/2,state.W/2);$("objectLibrary").appendChild(b)})
}
function populateThemes(){Object.entries(THEMES).forEach(([name,c])=>{const b=document.createElement("button");b.className="theme";b.title=name;b.style.setProperty("--a",c[0]);b.style.setProperty("--b",c[1]);b.onclick=()=>applyTheme(c);$("themeGrid").appendChild(b)})}
function applyTheme(c){["wall","floor","furniture"].forEach((k,i)=>{state.colors[k]=c[i];$(k==="wall"?"wallColor":k==="floor"?"floorColor":"furnitureColor").value=c[i]});renderRoom();state.objects.forEach(g=>{g.traverse(o=>{if(o.isMesh&&o.material===materials.furniture)o.material=materials.furniture})});commit()}
function updateArea(){$("areaValue").textContent=`${((+$("roomLength").value||0)*(+$("roomWidth").value||0)).toLocaleString()} sq ft`}
function bindUI(){
  populateRooms();populateCategories();populateLibrary();populateThemes();syncControls();
  $("searchInput").oninput=populateLibrary;$("clearSearch").onclick=()=>{$("searchInput").value="";populateLibrary()};
  $("applyRoomBtn").onclick=()=>{const L=+$('roomLength').value,W=+$('roomWidth').value;if(L<8||W<8||L>150||W>150){alert("Room dimensions must be between 8 and 150 ft.");return}state.L=L;state.W=W;state.objects=[];state.selectedId=null;renderRoom();clearObjects();$("emptyState").style.display="grid";updateCount();commit()};
  $("undoBtn").onclick=undo;$("redoBtn").onclick=redo;$("saveBtn").onclick=saveFile;$("loadBtn").onclick=()=>$("fileInput").click();$("fileInput").onchange=e=>e.target.files[0]&&loadFile(e.target.files[0]);
  $("resetBtn").onclick=()=>{if(confirm("Reset the current design?")){state={roomType:"office",L:30,W:24,colors:{wall:"#f4f0e8",floor:"#c8bda9",furniture:"#8c6746"},objects:[],selectedId:null,grid:true,snap:true,walls:true};history=[];historyIndex=-1;renderRoom();syncControls();populateRooms();loadPreset();commit()}};
  $("loadPresetBtn").onclick=()=>loadPreset();
  $("gridToggle").onchange=e=>{state.grid=e.target.checked;gridHelper.visible=state.grid;commit()};
  $("wallsToggle").onchange=e=>{state.walls=e.target.checked;renderRoom();commit()};
  $("snapToggle").onchange=e=>{state.snap=e.target.checked;commit()};
  [["wallColor","wall"],["floorColor","floor"],["furnitureColor","furniture"]].forEach(([id,k])=>$(id).oninput=e=>{state.colors[k]=e.target.value;renderRoom();commit()});
  $("deleteSelected").onclick=deleteSelected;$("duplicateSelected").onclick=duplicateSelected;$("rotateLeft").onclick=()=>rotateSelected(-90);$("centerSelected").onclick=()=>{if(selected){selected.position.set(state.L/2,0,state.W/2);syncObject(selected);selectObject(selected);commit()}};
  ["posX","posZ","scaleValue","rotationValue"].forEach(id=>$(id).onchange=updateTransform);
  $("viewTop").onclick=()=>setView("top");$("view3D").onclick=()=>setView("3d");$("viewFront").onclick=()=>setView("front");
  $("zoomOut").onclick=()=>distance=Math.min(220,distance*1.15);$("zoomIn").onclick=()=>distance=Math.max(8,distance*.85);$("zoomReset").onclick=()=>{distance=Math.max(state.L,state.W)*1.25+12};
  window.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redo():undo()}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){e.preventDefault();redo()}else if(e.key==="Delete"||e.key==="Backspace"){if(document.activeElement.tagName!=="INPUT")deleteSelected()}else if((e.key==="r"||e.key==="R")&&document.activeElement.tagName!=="INPUT")rotateSelected(90)});
  renderer.domElement.addEventListener("pointerdown",pointerDown);renderer.domElement.addEventListener("pointermove",pointerMove);renderer.domElement.addEventListener("pointerup",()=>drag=null);
  renderer.domElement.addEventListener("wheel",e=>{
    e.preventDefault();
    pointerCoords(e);
    const before=new THREE.Vector3();
    const hasHit=raycaster.ray.intersectPlane(plane,before);
    const factor=e.deltaY>0?1.10:0.90;
    distance=Math.min(240,Math.max(8,distance*factor));
    if(hasHit){
      updateCamera();
      const afterRay=new THREE.Raycaster();afterRay.setFromCamera(mouse,camera);
      const after=new THREE.Vector3();
      if(afterRay.ray.intersectPlane(plane,after)) target.add(before.sub(after));
    }
  },{passive:false});
}
function pointerCoords(e){const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(mouse,camera)}
function rootOf(o){while(o.parent&&o.parent!==objectGroup)o=o.parent;return o.parent===objectGroup?o:null}
function pointerDown(e){pointerCoords(e);const hitObj=raycaster.intersectObjects(objectGroup.children,true)[0],g=hitObj&&rootOf(hitObj.object);renderer.domElement.setPointerCapture(e.pointerId);
  if(g){selectObject(g);raycaster.ray.intersectPlane(plane,hit);drag={type:"object",offset:g.position.clone().sub(hit),last:g.position.clone()}}
  else {drag={type:"camera",x:e.clientX,y:e.clientY};}
}
function pointerMove(e){if(!drag)return;if(drag.type==="camera"){theta-=(e.clientX-drag.x)*.006;phi=Math.max(.12,Math.min(1.4,phi+(e.clientY-drag.y)*.005));drag.x=e.clientX;drag.y=e.clientY;return}
  pointerCoords(e);if(raycaster.ray.intersectPlane(plane,hit)&&selected){let x=hit.x+drag.offset.x,z=hit.z+drag.offset.z;if(state.snap){x=Math.round(x*2)/2;z=Math.round(z*2)/2}selected.position.set(x,0,z);clamp(selected);syncObject(selected);updateSelectionPanel();if(selectedBox)selectedBox.update()}
}
function deleteSelected(){if(!selected)return;const id=selected.userData.stateId;const idx=state.objects.findIndex(o=>o.id===id);if(idx>=0)state.objects.splice(idx,1);objectGroup.remove(selected);selectObject(null);updateCount();commit()}
function duplicateSelected(){if(!selected)return;const s=state.objects.find(o=>o.id===selected.userData.stateId);if(!s)return;addObject(s.defId,s.x+2,s.z+2,s.rotation,s.scale)}
function rotateSelected(deg){if(!selected)return;selected.rotation.y+=deg*Math.PI/180;clamp(selected);syncObject(selected);updateSelectionPanel();if(selectedBox)selectedBox.update();commit()}
function updateTransform(){if(!selected)return;selected.position.x=+$("posX").value;selected.position.z=+$("posZ").value;selected.scale.setScalar(+$("scaleValue").value);selected.rotation.y=(+$("rotationValue").value)*Math.PI/180;clamp(selected);syncObject(selected);if(selectedBox)selectedBox.update();commit()}
function setView(v){cameraMode=v;document.querySelectorAll(".floating-toolbar button").forEach(b=>b.classList.remove("active"));$(v==="top"?"viewTop":v==="front"?"viewFront":"view3D").classList.add("active")}
function updateCamera(){if(cameraMode==="top"){camera.position.set(target.x,Math.max(state.L,state.W)*1.7,target.z);camera.lookAt(target);return}if(cameraMode==="front"){camera.position.set(target.x,target.y+5,target.z+distance);camera.lookAt(target);return}camera.position.set(target.x+Math.sin(theta)*Math.cos(phi)*distance,target.y+Math.sin(phi)*distance,target.z+Math.cos(theta)*Math.cos(phi)*distance);camera.lookAt(target)}
function resize(){const host=$("viewport"),w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
function animate(){requestAnimationFrame(animate);updateCamera();if(selectedBox)selectedBox.update();renderer.render(scene,camera)}
window.addEventListener("resize",resize);
init();
