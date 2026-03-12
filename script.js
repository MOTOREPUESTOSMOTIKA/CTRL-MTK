console.log("Sistema Motika V3 - Contabilidad Profesional Activa");

/* --- ESTADO GLOBAL --- */
let productos = [];
let transacciones = [];
let encargos = [];
let historialReportes = [];
let historialGastos = [];
let historialAbonos = [];
let listaComprasMarcados = [];

/* --- FUNCIONES DE APOYO --- */
function limpiarNumero(valor) {
    if (!valor) return 0;
    return parseFloat(valor.toString().replace(/\./g, '').replace(',', '.')) || 0;
}

function formatearNumero(valor) {
    return Number(valor || 0).toLocaleString('es-CO');
}

/* --- SINCRONIZACIÓN FIREBASE --- */
db.ref('motika_data/').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        productos = data.productos || [];
        transacciones = data.transacciones || [];
        encargos = data.encargos || [];
        historialReportes = data.historialReportes || [];
        historialGastos = data.historialGastos || [];
        historialAbonos = data.historialAbonos || [];
        listaComprasMarcados = data.listaComprasMarcados || [];
        renderTodo();
    }
});

function actualizarTodo() {
    return db.ref('motika_data/').set({
        productos,
        transacciones,
        encargos,
        historialReportes,
        historialGastos,
        historialAbonos,
        listaComprasMarcados
    }).catch(error => console.error("Error Firebase:", error));
}

/* --- NAVEGACIÓN --- */
window.showSection = function(id) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

window.toggleMenu = function() {
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

/* --- INVENTARIO --- */
const fProd = document.getElementById('form-producto');
if(fProd) {
    fProd.addEventListener('submit', (e) => {
        e.preventDefault();
        productos.push({
            id: Date.now(),
            nombre: document.getElementById('prod-nombre').value,
            cantidad: parseInt(document.getElementById('prod-cantidad').value),
            costo: limpiarNumero(document.getElementById('prod-costo').value),
            precio: limpiarNumero(document.getElementById('prod-precio').value)
        });
        actualizarTodo();
        fProd.reset();
    });
}

window.editarStock = function(id) {
    const p = productos.find(x => x.id === id);
    const nuevoStock = prompt(`Editar Stock para ${p.nombre}:`, p.cantidad);
    if(nuevoStock !== null) {
        p.cantidad = parseInt(nuevoStock) || 0;
        actualizarTodo();
    }
}

window.eliminarProd = function(id) {
    if(confirm("¿Eliminar producto?")) {
        productos = productos.filter(p => p.id !== id);
        actualizarTodo();
    }
}

function renderInventario() {
    const t = document.getElementById('tabla-inventario');
    if(!t) return;
    let cTotal = 0, vTotal = 0;

    t.innerHTML = productos.map(p => {
        cTotal += (p.costo * p.cantidad);
        vTotal += (p.precio * p.cantidad);

        return `<tr>
            <td>${p.nombre}</td>
            <td class="${p.cantidad <= 2 ? 'stock-bajo' : ''}"><b>${p.cantidad}</b></td>
            <td>$${formatearNumero(p.costo)}</td>
            <td>$${formatearNumero(p.precio)}</td>
            <td><button class="btn-danger" onclick="eliminarProd(${p.id})">❌</button></td>
        </tr>`;
    }).join('');

    document.getElementById('float-costo').innerText = `$${formatearNumero(cTotal)}`;
    document.getElementById('float-venta').innerText = `$${formatearNumero(vTotal)}`;
}

/* --- GASTOS DIARIOS --- */
const fGastoLog = document.getElementById('form-gastos-diarios');
if(fGastoLog) {
    fGastoLog.addEventListener('submit', (e) => {
        e.preventDefault();

        const monto = limpiarNumero(document.getElementById('gasto-monto-op').value);
        const desc = document.getElementById('gasto-desc-op').value;
        const cat = document.getElementById('gasto-categoria').value;
        const fecha = document.getElementById('gasto-fecha').value || new Date().toLocaleDateString();

        const gastoData = { id: Date.now(), fecha, cat, desc, monto };

        historialGastos.push(gastoData);

        transacciones.push({
            id: Date.now()+1,
            tipo: 'gasto',
            desc: `[${cat}] ${desc}`,
            monto: monto,
            fecha: fecha
        });

        actualizarTodo();
        fGastoLog.reset();
        alert("Gasto registrado en contabilidad.");
    });
}

function renderGastos() {
    const tabla = document.getElementById('tabla-gastos-logistica');

    if(tabla) {
        tabla.innerHTML = historialGastos.slice(-20).map(g => `
            <tr>
            <td>${g.fecha}</td>
            <td>${g.cat}</td>
            <td>${g.desc}</td>
            <td style="color:red">-$${formatearNumero(g.monto)}</td>
            </tr>
        `).reverse().join('');
    }
}

/* --- LISTA DE COMPRAS CON CHULITO --- */
window.toggleMarcarCompra = function(nombreProd) {
    if (listaComprasMarcados.includes(nombreProd)) {
        listaComprasMarcados = listaComprasMarcados.filter(item => item !== nombreProd);
    } else {
        listaComprasMarcados.push(nombreProd);
    }
    actualizarTodo();
}

window.generarListaCompras = function() {
    const todosLosItems = [];

    encargos.filter(e => !e.entregadoTotal).forEach(ped => {
        ped.items.filter(it => !it.entregado).forEach(it => {
            todosLosItems.push({
                nombre: it.nombre,
                cant: it.cant,
                cliente: ped.cliente
            });
        });
    });

    const contenedor = document.getElementById('seccion-lista-compras');
    const ul = document.getElementById('lista-compras-items');

    ul.innerHTML = '';

    const ordenados = todosLosItems.sort((a, b) => {
        return (listaComprasMarcados.includes(a.nombre) ? 1 : 0)
        - (listaComprasMarcados.includes(b.nombre) ? 1 : 0);
    });

    ordenados.forEach(item => {
        const estaMarcado = listaComprasMarcados.includes(item.nombre);

        const li = document.createElement('li');

        li.className = `compra-item ${estaMarcado ? 'marcado' : ''}`;

        li.innerHTML = `
            <input type="checkbox"
            ${estaMarcado ? 'checked' : ''}
            onclick="toggleMarcarCompra('${item.nombre}')">

            <span>
            <b>${item.nombre}</b>
            (x${item.cant})
            - <small>${item.cliente}</small>
            </span>
        `;

        ul.appendChild(li);
    });

    contenedor.style.display = 'block';
}

/* --- DASHBOARD --- */
function renderDashboard() {

    let ing = 0;
    let gas = 0;
    let costoTotal = 0;

    transacciones.forEach(t => {

        if(t.tipo === 'ingreso') {
            ing += t.monto;
            costoTotal += (t.costoAsociado || 0);
        }
        else {
            gas += t.monto;
        }

    });

    document.getElementById('caja-ventas').innerText = `$${formatearNumero(ing)}`;
    document.getElementById('caja-gastos').innerText = `$${formatearNumero(gas)}`;
    document.getElementById('balance-final').innerText = `$${formatearNumero(ing - gas)}`;

    let invCosto = productos.reduce((acc, p) => acc + (p.costo * p.cantidad), 0);

    document.getElementById('dash-valor-inv').innerText = `$${formatearNumero(invCosto)}`;
}

/* --- PEDIDOS --- */
function renderPedidos() {

    const c = document.getElementById('lista-pedidos-clientes');

    if(!c) return;

    c.innerHTML = encargos
    .filter(e => !e.entregadoTotal)
    .map(e => `
        <div class="card">

            <strong>👤 ${e.cliente}</strong>

            <div class="items-contenedor">

            ${e.items.map((it, idx) => `
                <div class="item-pedido ${it.entregado ? 'entregado' : ''}">

                    <span>${it.nombre} (x${it.cant})</span>

                    ${!it.entregado ? `
                        <div class="btns">

                            <button class="btn-v"
                            onclick="procesarEntregaItem(${e.id}, ${idx}, 'venta')">
                            💰 Venta
                            </button>

                            <button class="btn-d"
                            onclick="procesarEntregaItem(${e.id}, ${idx}, 'deuda')">
                            📉 Deuda
                            </button>

                        </div>
                    ` : '✅'}

                </div>
            `).join('')}

            </div>

        </div>
    `).join('');

}

/* --- RENDER GENERAL --- */
function renderTodo() {

    renderDashboard();
    renderInventario();
    renderFinanzas();
    renderGastos();
    renderPedidos();
    renderDeudas();
    renderHistorialReportes();

}

window.onload = () => {
    if(window.toggleProductoSelector)
        window.toggleProductoSelector();
};