console.log("Sistema Motika cargado correctamente con Firebase");

/* ================= ESTADO GLOBAL ================= */
let productos = [];
let transacciones = [];
let encargos = [];
let deudores = [];
let historialReportes = [];
let ultimoCierre = 0;

/* ================= UTIL ================= */
function formato(n){
  return "$" + Number(n || 0).toLocaleString("es-CO");
}

function toggleMenu(){
  document.getElementById("sidebar").classList.toggle("open");
}

function showSection(id){
  document.querySelectorAll("section").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

/* ================= FIREBASE SYNC ================= */
function guardarDB(){
  db.ref("motika").set({
    productos,
    transacciones,
    encargos,
    deudores,
    historialReportes,
    ultimoCierre
  });
}

db.ref("motika").on("value", snap=>{
  if(!snap.exists()) return;
  const data = snap.val();
  productos = data.productos || [];
  transacciones = data.transacciones || [];
  encargos = data.encargos || [];
  deudores = data.deudores || [];
  historialReportes = data.historialReportes || [];
  ultimoCierre = data.ultimoCierre || 0;

  renderAll();
});

/* ================= INVENTARIO ================= */
document.getElementById("form-producto").addEventListener("submit",e=>{
  e.preventDefault();
  const nombre = document.getElementById("prod-nombre").value;
  const cantidad = Number(document.getElementById("prod-cantidad").value);
  const costo = Number(document.getElementById("prod-costo").value);
  const precio = Number(document.getElementById("prod-precio").value);

  productos.push({
    id: Date.now(),
    nombre,
    cantidad,
    costo,
    precio
  });

  e.target.reset();
  guardarDB();
});

function editarStock(id){
  const prod = productos.find(p=>p.id===id);
  const nuevo = prompt("Nuevo stock:", prod.cantidad);
  if(nuevo!==null){
    prod.cantidad = Number(nuevo);
    guardarDB();
  }
}

function eliminarProducto(id){
  productos = productos.filter(p=>p.id!==id);
  guardarDB();
}

function renderInventario(){
  const tbody = document.getElementById("tabla-inventario");
  tbody.innerHTML = "";
  let totalCosto=0;
  let totalVenta=0;

  productos.forEach(p=>{
    totalCosto += p.cantidad * p.costo;
    totalVenta += p.cantidad * p.precio;

    tbody.innerHTML += `
      <tr>
        <td>${p.nombre}</td>
        <td>${p.cantidad}</td>
        <td>${formato(p.costo)}</td>
        <td>${formato(p.precio)}</td>
        <td><button onclick="editarStock(${p.id})">✏</button></td>
        <td><button onclick="eliminarProducto(${p.id})">🗑</button></td>
      </tr>
    `;
  });

  document.getElementById("float-costo").innerText=formato(totalCosto);
  document.getElementById("float-venta").innerText=formato(totalVenta);
  document.getElementById("dash-valor-inv").innerText=formato(totalCosto);
}

/* ================= TRANSACCIONES ================= */
document.getElementById("form-transaccion").addEventListener("submit",e=>{
  e.preventDefault();
  const tipo = document.getElementById("trans-tipo").value;
  const desc = document.getElementById("trans-desc").value;
  let monto = Number(document.getElementById("trans-monto").value);
  const cantidad = Number(document.getElementById("trans-cantidad").value);

  if(tipo==="venta"){
    const id = Number(document.getElementById("select-producto-id").value);
    const prod = productos.find(p=>p.id===id);
    if(!prod || prod.cantidad < cantidad) return alert("Stock insuficiente");

    prod.cantidad -= cantidad;
    monto = prod.precio * cantidad;

    transacciones.push({
      fecha:Date.now(),
      tipo:"venta",
      descripcion:prod.nombre,
      monto,
      costo: prod.costo * cantidad
    });
  }

  if(tipo==="ingreso"){
    transacciones.push({
      fecha:Date.now(),
      tipo:"ingreso",
      descripcion:desc,
      monto,
      costo:0
    });
  }

  if(tipo==="gasto"){
    transacciones.push({
      fecha:Date.now(),
      tipo:"gasto",
      descripcion:desc,
      monto:-monto,
      costo:0
    });
  }

  e.target.reset();
  guardarDB();
});

function renderTransacciones(){
  const tbody=document.getElementById("lista-transacciones");
  tbody.innerHTML="";
  transacciones.slice().reverse().forEach(t=>{
    tbody.innerHTML+=`
      <tr>
        <td>${new Date(t.fecha).toLocaleDateString()}</td>
        <td>${t.descripcion}</td>
        <td>${formato(t.monto)}</td>
      </tr>
    `;
  });
}

/* ================= DASHBOARD ================= */
function renderDashboard(){
  let ingresosGlobal=0;
  let gastosGlobal=0;
  let gananciaGlobal=0;

  let ingresosParcial=0;
  let gastosParcial=0;
  let gananciaParcial=0;

  transacciones.forEach(t=>{
    if(t.monto>0) ingresosGlobal+=t.monto;
    if(t.monto<0) gastosGlobal+=t.monto;
    if(t.tipo==="venta") gananciaGlobal += (t.monto - t.costo);

    if(t.fecha > ultimoCierre){
      if(t.monto>0) ingresosParcial+=t.monto;
      if(t.monto<0) gastosParcial+=t.monto;
      if(t.tipo==="venta") gananciaParcial += (t.monto - t.costo);
    }
  });

  document.getElementById("total-ingresos-global").innerText=formato(ingresosGlobal);
  document.getElementById("total-gastos-global").innerText=formato(gastosGlobal);
  document.getElementById("balance-global").innerText=formato(ingresosGlobal+gastosGlobal);
  document.getElementById("ganancia-global").innerText=formato(gananciaGlobal);

  document.getElementById("total-ingresos-parcial").innerText=formato(ingresosParcial);
  document.getElementById("total-gastos-parcial").innerText=formato(gastosParcial);
  document.getElementById("balance-parcial").innerText=formato(ingresosParcial+gastosParcial);
  document.getElementById("ganancia-parcial").innerText=formato(gananciaParcial);

  const patrimonio = (ingresosGlobal+gastosGlobal);
  document.getElementById("dash-patrimonio").innerText=formato(patrimonio);
}

function cerrarCaja(){
  const ahora=Date.now();
  historialReportes.push({
    fecha:ahora,
    ingresos: document.getElementById("total-ingresos-parcial").innerText,
    gastos: document.getElementById("total-gastos-parcial").innerText,
    balance: document.getElementById("balance-parcial").innerText
  });
  ultimoCierre=ahora;
  guardarDB();
  alert("Caja cerrada correctamente");
}

/* ================= DEUDORES ================= */
document.getElementById("form-deuda-directa").addEventListener("submit",e=>{
  e.preventDefault();
  const nombre=document.getElementById("deuda-cliente").value;
  const monto=Number(document.getElementById("deuda-monto").value);

  let cliente=deudores.find(d=>d.nombre===nombre);
  if(cliente){
    cliente.deuda+=monto;
  }else{
    deudores.push({nombre,deuda:monto});
  }

  guardarDB();
  e.target.reset();
});

function renderDeudores(){
  const tbody=document.getElementById("tabla-deudores");
  tbody.innerHTML="";
  deudores.forEach(d=>{
    tbody.innerHTML+=`
      <tr>
        <td>${d.nombre}</td>
        <td>${formato(d.deuda)}</td>
        <td><input type="number" id="abono-${d.nombre}" placeholder="Abono"></td>
        <td><button onclick="abonar('${d.nombre}')">Abonar</button></td>
      </tr>
    `;
  });
}

function abonar(nombre){
  const input=document.getElementById("abono-"+nombre);
  const monto=Number(input.value);
  const cliente=deudores.find(d=>d.nombre===nombre);
  if(!cliente || monto<=0) return;

  cliente.deuda-=monto;
  transacciones.push({
    fecha:Date.now(),
    tipo:"ingreso",
    descripcion:"Abono deuda "+nombre,
    monto,
    costo:0
  });

  guardarDB();
}

/* ================= RENDER GLOBAL ================= */
function renderAll(){
  renderInventario();
  renderTransacciones();
  renderDashboard();
  renderDeudores();
}