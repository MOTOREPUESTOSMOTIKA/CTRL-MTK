console.log("Sistema Motika V4 - Contabilidad & Logística Optimizada");

/* --- ESTADO GLOBAL --- */
let productos = [];
let transacciones = [];
let encargos = [];
let historialReportes = [];
let historialGastos = [];
let listaComprasMarcados = []; // Para persistir los chulitos de la lista de compras

/* --- FUNCIONES DE APOYO --- */
const limpiarNumero = (v) => !v ? 0 : parseFloat(v.toString().replace(/\./g, '').replace(',', '.')) || 0;
const formatearNumero = (v) => Number(v || 0).toLocaleString('es-CO');

/* --- SINCRONIZACIÓN FIREBASE --- */
db.ref('motika_data/').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        productos = data.productos || [];
        transacciones = data.transacciones || [];
        encargos = data.encargos || [];
        historialReportes = data.historialReportes || [];
        historialGastos = data.historialGastos || [];
        listaComprasMarcados = data.listaComprasMarcados || [];
        renderTodo();
    }
});

function actualizarTodo() {
    return db.ref('motika_data/').set({
        productos, transacciones, encargos, historialReportes, historialGastos, listaComprasMarcados
    }).catch(error => console.error("Error Firebase:", error));
}

/* --- NAVEGACIÓN --- */
window.showSection = (id) => {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

window.toggleMenu = () => {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768) sidebar.classList.toggle('active');
}

/* --- BUSCADOR DE PRODUCTOS (VENTAS) --- */
const inputBusqueda = document.getElementById('input-buscar-prod');
if (inputBusqueda) {
    inputBusqueda.addEventListener('input', () => {
        const texto = inputBusqueda.value.toLowerCase();
        const sug = document.getElementById('lista-sugerencias');
        sug.innerHTML = '';
        if (texto.length < 1) return;

        const coincidencias = productos.filter(p => p.nombre.toLowerCase().includes(texto));
        
        coincidencias.forEach(p => {
            const d = document.createElement('div');
            d.className = 'sugerencia-item';
            d.innerHTML = `<span>${p.nombre}</span> <small>Stock: ${p.cantidad} | $${formatearNumero(p.precio)}</small>`;
            d.onclick = () => {
                inputBusqueda.value = p.nombre;
                document.getElementById('select-producto-id').value = p.id;
                sug.innerHTML = '';
            };
            sug.appendChild(d);
        });
    });
}

/* --- GESTIÓN DE PEDIDOS (SIN TOTAL OBLIGATORIO) --- */
window.agregarFila = () => {
    const div = document.createElement('div');
    div.className = 'fila-producto';
    div.innerHTML = `<input type="text" placeholder="Producto" class="p-nombre" required> 
                     <input type="number" placeholder="Cant." class="p-cant" required> 
                     <button type="button" onclick="this.parentElement.remove()">✕</button>`;
    document.getElementById('contenedor-filas-productos').appendChild(div);
}

const fEnc = document.getElementById('form-encargo');
if(fEnc) {
    fEnc.addEventListener('submit', (e) => {
        e.preventDefault();
        const cliente = document.getElementById('enc-cliente').value;
        const abono = limpiarNumero(document.getElementById('enc-abono').value) || 0;
        
        encargos.push({
            id: Date.now(),
            cliente,
            abono,
            deuda: 0, // Se calcula dinámicamente al entregar
            entregadoTotal: false,
            items: Array.from(document.querySelectorAll('.fila-producto')).map(f => ({
                nombre: f.querySelector('.p-nombre').value,
                cant: parseInt(f.querySelector('.p-cant').value),
                entregado: false
            }))
        });
        
        if(abono > 0) {
            transacciones.push({
                id: Date.now() + 1, tipo: 'ingreso', desc: `Abono inicial: ${cliente}`,
                monto: abono, fecha: new Date().toLocaleDateString(), costoAsociado: 0
            });
        }
        actualizarTodo();
        fEnc.reset();
        document.getElementById('contenedor-filas-productos').innerHTML = '<div class="fila-producto"><input type="text" placeholder="Producto" class="p-nombre" required><input type="number" placeholder="Cant." class="p-cant" required></div>';
    });
}

/* --- LISTA DE COMPRAS CON CHULITO --- */
window.toggleMarcarCompra = (nombreProd) => {
    if (listaComprasMarcados.includes(nombreProd)) {
        listaComprasMarcados = listaComprasMarcados.filter(item => item !== nombreProd);
    } else {
        listaComprasMarcados.push(nombreProd);
    }
    actualizarTodo();
}

window.generarListaCompras = () => {
    const todosLosItems = [];
    encargos.filter(e => !e.entregadoTotal).forEach(ped => {
        ped.items.filter(it => !it.entregado).forEach(it => {
            todosLosItems.push({ nombre: it.nombre, cant: it.cant, cliente: ped.cliente });
        });
    });

    const contenedor = document.getElementById('seccion-lista-compras');
    const ul = document.getElementById('lista-compras-items');
    ul.innerHTML = '';

    // Ordenar: Los NO marcados primero, los marcados al final
    const ordenados = todosLosItems.sort((a, b) => {
        return (listaComprasMarcados.includes(a.nombre) ? 1 : 0) - (listaComprasMarcados.includes(b.nombre) ? 1 : 0);
    });

    ordenados.forEach(item => {
        const estaMarcado = listaComprasMarcados.includes(item.nombre);
        const li = document.createElement('li');
        li.className = `compra-item ${estaMarcado ? 'marcado' : ''}`;
        li.innerHTML = `
            <input type="checkbox" ${estaMarcado ? 'checked' : ''} onclick="toggleMarcarCompra('${item.nombre}')">
            <span><b>${item.nombre}</b> (x${item.cant}) - <small>${item.cliente}</small></span>
        `;
        ul.appendChild(li);
    });
    contenedor.style.display = 'block';
}

/* --- ENTREGAS Y CAJA --- */
window.procesarEntregaItem = (pedidoId, itemIndex, modo) => {
    const p = encargos.find(x => x.id === pedidoId);
    const item = p.items[itemIndex];
    
    const prodInv = productos.find(prod => prod.nombre.toLowerCase() === item.nombre.toLowerCase());
    let costoItem = 0;
    if(prodInv) {
        prodInv.cantidad -= item.cant;
        costoItem = prodInv.costo * item.cant;
    }

    if(modo === 'venta') {
        const valorVenta = prompt(`Precio de venta para ${item.nombre}:`, prodInv ? prodInv.precio : "");
        const monto = limpiarNumero(valorVenta);
        transacciones.push({
            id: Date.now(), tipo: 'ingreso', desc: `Pedido: ${item.nombre} (${p.cliente})`,
            monto: monto, costoAsociado: costoItem, fecha: new Date().toLocaleDateString()
        });
    } else {
        const valorDeuda = prompt(`Monto a cargar a DEUDA por ${item.nombre}:`, prodInv ? prodInv.precio : "");
        p.deuda += limpiarNumero(valorDeuda);
    }
    
    item.entregado = true;
    if(p.items.every(i => i.entregado)) p.entregadoTotal = true;
    actualizarTodo();
}

/* --- RENDERS Y DASHBOARD --- */
function renderDashboard() {
    let ing = 0, gas = 0, costoTotal = 0;
    transacciones.forEach(t => {
        if(t.tipo === 'ingreso') { ing += t.monto; costoTotal += (t.costoAsociado || 0); }
        else gas += t.monto;
    });

    document.getElementById('caja-ventas').innerText = `$${formatearNumero(ing)}`;
    document.getElementById('caja-gastos').innerText = `$${formatearNumero(gas)}`;
    document.getElementById('balance-final').innerText = `$${formatearNumero(ing - gas)}`;
    
    let invCosto = productos.reduce((acc, p) => acc + (p.costo * p.cantidad), 0);
    document.getElementById('dash-valor-inv').innerText = `$${formatearNumero(invCosto)}`;
}

function renderPedidos() {
    const c = document.getElementById('lista-pedidos-clientes');
    if(!c) return;
    c.innerHTML = encargos.filter(e => !e.entregadoTotal).map(e => `
        <div class="card">
            <strong>👤 ${e.cliente}</strong>
            <div class="items-contenedor">
                ${e.items.map((it, idx) => `
                    <div class="item-pedido ${it.entregado ? 'entregado' : ''}">
                        <span>${it.nombre} (x${it.cant})</span>
                        ${!it.entregado ? `
                            <div class="btns">
                                <button class="btn-v" onclick="procesarEntregaItem(${e.id}, ${idx}, 'venta')">💰 Venta</button>
                                <button class="btn-d" onclick="procesarEntregaItem(${e.id}, ${idx}, 'deuda')">📉 Deuda</button>
                            </div>` : '✅'}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function renderTodo() {
    renderDashboard();
    renderPedidos();
    renderInventario();
    renderFinanzas();
    renderDeudas();
}

window.onload = () => { if(window.toggleProductoSelector) window.toggleProductoSelector(); };
