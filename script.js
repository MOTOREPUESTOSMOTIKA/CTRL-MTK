console.log("Sistema Motika cargado correctamente");

/* --- ESTADO GLOBAL --- */
let productos = JSON.parse(localStorage.getItem('productos')) || [];
let transacciones = JSON.parse(localStorage.getItem('transacciones')) || [];
let encargos = JSON.parse(localStorage.getItem('encargos')) || [];
let historialReportes = JSON.parse(localStorage.getItem('historialReportes')) || [];

/* --- NAVEGACIÓN --- */
window.showSection = function(id) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
}

/* --- CONTROL DEL MENÚ CELULAR --- */
window.toggleMenu = function() {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768 && sidebar) {
        sidebar.classList.toggle('active');
    }
}

/* --- GESTIÓN DE PRODUCTOS --- */
const fProd = document.getElementById('form-producto');
if(fProd) {
    fProd.addEventListener('submit', (e) => {
        e.preventDefault();
        productos.push({
            id: Date.now(),
            nombre: document.getElementById('prod-nombre').value,
            cantidad: parseInt(document.getElementById('prod-cantidad').value),
            costo: parseFloat(document.getElementById('prod-costo').value),
            precio: parseFloat(document.getElementById('prod-precio').value)
        });
        actualizarTodo();
        fProd.reset();
    });
}

window.eliminarProd = function(id) {
    if(confirm("¿Eliminar este producto?")) {
        productos = productos.filter(p => p.id !== id);
        actualizarTodo();
    }
}

/* --- GESTIÓN DE PEDIDOS --- */
window.agregarFila = function() {
    const div = document.createElement('div');
    div.className = 'fila-producto';
    div.innerHTML = `
        <input type="text" placeholder="Producto" class="p-nombre" required> 
        <input type="number" placeholder="Cant." class="p-cant" required> 
        <button type="button" onclick="this.parentElement.remove()" style="color:red; background:none; border:none; cursor:pointer;">✕</button>
    `;
    const contenedor = document.getElementById('contenedor-filas-productos');
    if(contenedor) contenedor.appendChild(div);
}

const fEnc = document.getElementById('form-encargo');
if(fEnc) {
    fEnc.addEventListener('submit', (e) => {
        e.preventDefault();
        const cliente = document.getElementById('enc-cliente').value;
        const total = parseFloat(document.getElementById('enc-total').value);
        const abono = parseFloat(document.getElementById('enc-abono').value) || 0;
        
        encargos.push({
            id: Date.now(),
            cliente: cliente,
            total: total,
            abono: abono,
            deuda: total - abono,
            entregadoTotal: false,
            tipo: 'pedido',
            items: Array.from(document.querySelectorAll('.fila-producto')).map(f => ({
                nombre: f.querySelector('.p-nombre').value,
                cant: f.querySelector('.p-cant').value
            }))
        });
        
        if(abono > 0) {
            transacciones.push({
                id: Date.now() + 1,
                tipo: 'ingreso',
                desc: `Abono inicial: ${cliente}`,
                monto: abono,
                fecha: new Date().toLocaleDateString()
            });
        }
        actualizarTodo();
        fEnc.reset();
        document.getElementById('contenedor-filas-productos').innerHTML = '<div class="fila-producto"><input type="text" placeholder="Producto" class="p-nombre" required><input type="number" placeholder="Cant." class="p-cant" required></div>';
    });
}

window.entregarPedido = function(id) {
    const e = encargos.find(x => x.id === id);
    if(e.deuda > 0) {
        alert(`No se puede entregar. El cliente aún debe $${e.deuda}`);
        return;
    }
    if(confirm("¿Confirmar entrega total del pedido?")) {
        e.entregadoTotal = true;
        actualizarTodo();
    }
}

/* --- DEUDORES --- */
const fDeuda = document.getElementById('form-deuda-directa');
if(fDeuda) {
    fDeuda.addEventListener('submit', (e) => {
        e.preventDefault(); 
        const m = parseFloat(document.getElementById('deuda-monto').value);
        const c = document.getElementById('deuda-cliente').value;
        
        encargos.push({
            id: Date.now(),
            cliente: c,
            total: m,
            abono: 0,
            deuda: m,
            entregadoTotal: true,
            tipo: 'directa'
        });
        actualizarTodo();
        fDeuda.reset();
        alert("Deudor registrado correctamente");
    });
}

window.abonar = function(id) {
    const e = encargos.find(x => x.id === id);
    const input = document.getElementById(`in-abono-${id}`);
    if(!input) return;
    const monto = parseFloat(input.value);
    
    if(!monto || monto <= 0 || monto > e.deuda) return alert("Monto inválido");
    
    e.deuda -= monto;
    e.abono += monto;
    transacciones.push({
        id: Date.now(),
        tipo: 'ingreso', 
        desc: `Abono de: ${e.cliente}`, 
        monto: monto, 
        fecha: new Date().toLocaleDateString()
    });
    actualizarTodo();
}

/* --- VENTAS Y BÚSQUEDA --- */
const inputBusqueda = document.getElementById('input-buscar-prod');
const listaSugerencias = document.getElementById('lista-sugerencias');
const hiddenId = document.getElementById('select-producto-id');

if (inputBusqueda) {
    inputBusqueda.addEventListener('input', () => {
        const texto = inputBusqueda.value.toLowerCase();
        listaSugerencias.innerHTML = '';
        if (texto.length < 1) return;
        const coincidencias = productos.filter(p => p.nombre.toLowerCase().includes(texto) && p.cantidad > 0);
        coincidencias.forEach(p => {
            const div = document.createElement('div');
            div.innerHTML = `${p.nombre} (Stock: ${p.cantidad})`;
            div.style = "padding:8px; cursor:pointer; border-bottom:1px solid #eee; background:white;";
            div.onclick = () => {
                inputBusqueda.value = p.nombre;
                hiddenId.value = p.id;
                listaSugerencias.innerHTML = '';
            };
            listaSugerencias.appendChild(div);
        });
    });
}

const fTrans = document.getElementById('form-transaccion');
if(fTrans) {
    fTrans.addEventListener('submit', (e) => {
        e.preventDefault();
        const tipo = document.getElementById('trans-tipo').value;
        let monto = parseFloat(document.getElementById('trans-monto').value) || 0;
        let desc = document.getElementById('trans-desc').value;

        if(tipo === 'venta') {
            const pId = hiddenId.value;
            const cant = parseInt(document.getElementById('trans-cantidad').value);
            const p = productos.find(x => x.id == pId);
            if(p && p.cantidad >= cant) {
                p.cantidad -= cant;
                monto = p.precio * cant;
                desc = `Venta: ${p.nombre} x${cant}`;
            } else {
                return alert("Selecciona un producto válido con stock.");
            }
        }

        transacciones.push({
            id: Date.now(),
            tipo: (tipo === 'gasto' ? 'gasto' : 'ingreso'),
            desc: desc,
            monto: monto,
            fecha: new Date().toLocaleDateString()
        });
        actualizarTodo();
        fTrans.reset();
        window.toggleProductoSelector();
    });
}

/* --- RENDERIZADO --- */
function actualizarTodo() {
    localStorage.setItem('productos', JSON.stringify(productos));
    localStorage.setItem('transacciones', JSON.stringify(transacciones));
    localStorage.setItem('encargos', JSON.stringify(encargos));
    renderInventario();
    renderPedidos();
    renderDeudas();
    renderFinanzas();
    renderDashboard();
    renderHistorialReportes();
}

function renderDashboard() {
    let ing = 0, gas = 0;
    transacciones.forEach(t => t.tipo === 'ingreso' ? ing += t.monto : gas += t.monto);
    
    const eGan = document.getElementById('total-ganancias');
    const eGas = document.getElementById('total-gastos');
    const eBal = document.getElementById('balance-final');
    const eInv = document.getElementById('dash-valor-inv');
    const ePat = document.getElementById('dash-patrimonio');

    let valorCostoInv = productos.reduce((acc, p) => acc + (p.costo * p.cantidad), 0);
    let balanceActual = ing - gas;

    if(eGan) eGan.innerText = `$${ing.toLocaleString()}`;
    if(eGas) eGas.innerText = `$${gas.toLocaleString()}`;
    if(eBal) eBal.innerText = `$${balanceActual.toLocaleString()}`;
    if(eInv) eInv.innerText = `$${valorCostoInv.toLocaleString()}`;
    if(ePat) ePat.innerText = `$${(valorCostoInv + balanceActual).toLocaleString()}`;
}

function renderInventario() {
    const t = document.getElementById('tabla-inventario');
    if(!t) return;
    let cTotal = 0, vTotal = 0;
    t.innerHTML = productos.map(p => {
        cTotal += (p.costo * p.cantidad); vTotal += (p.precio * p.cantidad);
        return `<tr><td>${p.nombre}</td><td>${p.cantidad}</td><td>$${p.costo}</td><td>$${p.precio}</td><td><button onclick="eliminarProd(${p.id})">❌</button></td></tr>`;
    }).join('');
    document.getElementById('float-costo').innerText = `$${cTotal.toLocaleString()}`;
    document.getElementById('float-venta').innerText = `$${vTotal.toLocaleString()}`;
}

function renderFinanzas() {
    const lista = document.getElementById('lista-transacciones');
    if(lista) {
        lista.innerHTML = transacciones.map(t => `
            <tr><td>${t.fecha}</td><td>${t.desc}</td><td style="color:${t.tipo==='ingreso'?'green':'red'}">$${t.monto}</td></tr>
        `).reverse().join('');
    }
}

function renderDeudas() {
    const t = document.getElementById('tabla-deudores');
    if(!t) return;
    t.innerHTML = encargos.filter(e => e.deuda > 0).map(e => `
        <tr><td>${e.cliente}</td><td style="color:red">$${e.deuda}</td>
        <td><input type="number" id="in-abono-${e.id}" style="width:70px"></td>
        <td><button onclick="abonar(${e.id})">Abonar</button></td></tr>
    `).join('');
}

function renderPedidos() {
    const c = document.getElementById('lista-pedidos-clientes');
    if(!c) return;
    c.innerHTML = encargos.filter(e => e.tipo === 'pedido' && !e.entregadoTotal).map(e => `
        <div class="card">
            <strong>👤 ${e.cliente}</strong><br>Debe: $${e.deuda}
            <button onclick="entregarPedido(${e.id})" style="width:100%; margin-top:5px;">Entregar</button>
        </div>
    `).join('');
}

window.toggleProductoSelector = function() {
    const tipo = document.getElementById('trans-tipo').value;
    const isVenta = (tipo === 'venta');
    document.getElementById('contenedor-busqueda-prod').style.display = isVenta ? 'block' : 'none';
    document.getElementById('trans-cantidad').style.display = isVenta ? 'block' : 'none';
    document.getElementById('trans-monto').style.display = isVenta ? 'none' : 'block';
    document.getElementById('trans-desc').style.display = isVenta ? 'none' : 'block';
}

/* --- REPORTES --- */
window.cerrarCaja = function() {
    if (!confirm("¿Cerrar caja?")) return;
    let ing = 0, gas = 0;
    transacciones.forEach(t => t.tipo === 'ingreso' ? ing += t.monto : gas += t.monto);

    historialReportes.push({
        id: Date.now(),
        fecha: new Date().toLocaleString(),
        balanceNeto: ing - gas,
        totalIngresos: ing,
        totalGastos: gas,
        valorInventario: productos.reduce((acc, p) => acc + (p.precio * p.cantidad), 0),
        deudasPendientes: encargos.reduce((acc, e) => acc + e.deuda, 0),
        detalleVentas: transacciones.filter(t => t.tipo === 'ingreso').map(t => t.desc),
        detalleGastos: transacciones.filter(t => t.tipo === 'gasto').map(t => t.desc)
    });
    
    transacciones = []; 
    actualizarTodo();
}

function renderHistorialReportes() {
    const contenedor = document.getElementById('historial-reportes');
    if (!contenedor) return;
    contenedor.innerHTML = historialReportes.map(r => `
        <div class="card" style="border-left:5px solid green;">
            <h4>📅 ${r.fecha}</h4>
            <p><b>Balance: $${r.balanceNeto.toLocaleString()}</b></p>
            <button onclick="eliminarReporte(${r.id})" style="color:red; background:none; border:none; cursor:pointer;">Eliminar</button>
        </div>
    `).reverse().join('');
}

window.eliminarReporte = function(id) {
    if(confirm("¿Eliminar reporte?")) {
        historialReportes = historialReportes.filter(r => r.id !== id);
        actualizarTodo();
    }
}

window.generarListaCompras = function() {
    const contenedor = document.getElementById('seccion-lista-compras');
    const listaUl = document.getElementById('lista-compras-items');
    const pedidosPendientes = encargos.filter(e => e.tipo === 'pedido' && !e.entregadoTotal);
    
    const consolidado = {};
    pedidosPendientes.forEach(pedido => {
        pedido.items.forEach(item => {
            const nombre = item.nombre.trim().toLowerCase();
            consolidado[nombre] = (consolidado[nombre] || 0) + parseInt(item.cant);
        });
    });

    listaUl.innerHTML = Object.entries(consolidado).map(([prod, cant]) => `
        <li><input type="checkbox"> ${prod} - x${cant}</li>
    `).join('');
    contenedor.style.display = 'block';
}

window.onload = () => {
    actualizarTodo();
    window.toggleProductoSelector();
};
