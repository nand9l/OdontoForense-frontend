document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'dashboard.html';
    return;
  }
  window.graficoVitimas = null;
  let dadosGenero = {};
  let dadosIdade = {};
  let todosCasos = [];

  try {
    const response = await fetch('https://odontoforense-backend.onrender.com/api/casos?limit=1000', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const result = await response.json();
    todosCasos = result.data.docs || result.data;
    aplicarFiltroEAtualizarGraficos(); // Carrega dados iniciais com todos os casos
  } catch (err) {
    console.error('Erro ao buscar casos:', err);
  }

  try {
    await carregarResumoUsuarios(token);
    await carregarTotalEvidencias(token);
    
  } catch (err) {
    console.error('Erro completo:', err);
    localStorage.removeItem('token');
    window.location.href = 'index.html';
  }

  document.getElementById('btnFiltrar').addEventListener('click', aplicarFiltroEAtualizarGraficos);

  function aplicarFiltroEAtualizarGraficos() {
    const inicio = new Date(document.getElementById('dataInicio').value);
    const fim = new Date(document.getElementById('dataFim').value);
    fim.setHours(23, 59, 59, 999);

    const casosFiltrados = todosCasos.filter(caso => {
      const data = new Date(caso.dataOcorrido);
      return (!isNaN(inicio) ? data >= inicio : true) && (!isNaN(fim) ? data <= fim : true);
    });

    carregarResumoCasosFiltrados(casosFiltrados);
    gerarGraficosVitimas(casosFiltrados);
    carregarResumoEvidenciasFiltradas(casosFiltrados);
  }
});

function carregarResumoCasosFiltrados(casos) {
  const cards = document.querySelectorAll('.card-counter h1');
  if (cards.length > 0) {
    cards[0].textContent = casos.length;
  }

  const statusContagem = { Aberto: 0, 'Em andamento': 0, Fechado: 0 };
  casos.forEach(caso => {
    const status = (caso.status || '').trim().toLowerCase();
    if (status === 'aberto') statusContagem.Aberto++;
    else if (status === 'em andamento') statusContagem['Em andamento']++;
    else if (status === 'fechado') statusContagem.Fechado++;
  });

  const ctxStatus = document.getElementById('graficoCasos').getContext('2d');
  if (window.graficoStatus) window.graficoStatus.destroy();
  window.graficoStatus = new Chart(ctxStatus, {
    type: 'doughnut',
    data: {
      labels: ['Aberto', 'Em andamento', 'Fechado'],
      datasets: [{
        data: [statusContagem.Aberto, statusContagem['Em andamento'], statusContagem.Fechado],
        backgroundColor: ['#198754', '#fd7e14', '#dc3545']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });

  // Gráfico de linha por dia
  // Agrupar os dados por mês a partir da lista de casos
  const casosPorMes = {};
  casos.forEach(caso => {
    const data = new Date(caso.dataOcorrido);
    if (isNaN(data)) return;
    const mesAno = `${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;
    casosPorMes[mesAno] = (casosPorMes[mesAno] || 0) + 1;
  });

  // Obter os meses ordenados
  const mesesOrdenados = Object.keys(casosPorMes).sort((a, b) => {
    const [mesA, anoA] = a.split('/').map(Number);
    const [mesB, anoB] = b.split('/').map(Number);
    return new Date(anoA, mesA - 1) - new Date(anoB, mesB - 1);
  });

// Calcular o valor máximo para ajustar o eixo Y
const valores = mesesOrdenados.map(m => casosPorMes[m]);
const maxValor = Math.max(...valores);
const paddingY = Math.ceil(maxValor * 0.25); // 15% de folga visual

// Criar o gráfico com os dados mensais
const ctxLinha = document.getElementById('graficoCasosPorMes').getContext('2d');
if (window.graficoLinha) window.graficoLinha.destroy();
window.graficoLinha = new Chart(ctxLinha, {
  type: 'line',
  data: {
    labels: mesesOrdenados,
    datasets: [{
      label: 'Casos por Mês',
      data: valores,
      borderColor: '#0d6efd',
      backgroundColor: 'rgba(13, 110, 253, 0.2)',
      fill: true,
      tension: 0.3,
      pointBackgroundColor: '#0d6efd',
      clip: false // impede o corte lateral dos dados/rótulos
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: {
        anchor: 'end',
        align: 'top',
        font: { weight: 'bold' },
        formatter: (value) => value,
        color: '#0d6efd',
        clamp: true, // impede o corte do rótulo
        clip: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: maxValor + paddingY,
        title: { display: true, text: 'Quantidade de Casos' }
      },
      x: {
        title: { display: true, text: 'Mês/Ano' }
      }
    }
  },
  plugins: [ChartDataLabels]
});
  exibirMapaDeCasos(casos);
}

async function carregarResumoEvidenciasFiltradas(casos) {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const response = await fetch('https://odontoforense-backend.onrender.com/api/evidencias?limit=1000', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    const evidencias = result.data.docs || result.data;

    const idsCasos = casos.map(c => c._id);
    const evidenciasFiltradas = evidencias.filter(ev => idsCasos.includes(ev.caso));

    const cards = document.querySelectorAll('.card-counter h1');
    if (cards.length > 1) {
      cards[1].textContent = evidenciasFiltradas.length;
    }
  } catch (err) {
    console.error('Erro ao carregar evidências:', err);
  }
}

async function carregarResumoUsuarios(token) {
  try {
    const res = await fetch('https://odontoforense-backend.onrender.com/api/usuarios', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const resultado = await res.json();
    const usuarios = resultado.data || resultado;

    const cards = document.querySelectorAll('.card-counter h1');
    if (cards.length > 2) {
      cards[2].textContent = usuarios.length;
    }

    const contagemPorTipo = { assistente: 0, perito: 0, administrador: 0 };
    usuarios.forEach(u => {
      const tipo = u.tipo?.toLowerCase();
      if (contagemPorTipo[tipo] !== undefined) {
        contagemPorTipo[tipo]++;
      }
    });

    const ctx = document.getElementById('graficoUsuariosPorTipo')?.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Assistente', 'Perito', 'Administrador'],
          datasets: [{
            label: 'Usuários por Tipo',
            data: [
              contagemPorTipo.assistente,
              contagemPorTipo.perito,
              contagemPorTipo.administrador
            ],
            backgroundColor: ['#0dcaf0', '#198754', '#6f42c1']
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              bodyFont: { size: 12 }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Quantidade de Usuários' }
            },
            x: {
              title: { display: true, text: 'Tipo de Usuário' }
            }
          }
        }
      });
    }
  } catch (err) {
    console.error('Erro ao carregar usuários:', err);
  }
}

async function exibirMapaDeCasos(casos) {
  const mapa = L.map('mapaCasos').setView([-14.2350, -51.9253], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(mapa);

  const geocodeCache = {};

  for (const caso of casos) {
    const local = caso.local?.trim();
    if (!local) continue;

    let coords = geocodeCache[local];

    if (!coords) {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(local)}`, {
          headers: { 'User-Agent': 'ODONTOCRIM Dashboard' }
        });

        const data = await response.json();
        if (data.length > 0) {
          coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          geocodeCache[local] = coords;
        } else {
          console.warn('Local não encontrado:', local);
          continue;
        }
      } catch (error) {
        console.error('Erro ao buscar coordenadas de:', local, error);
        continue;
      }
    }

    L.marker(coords).addTo(mapa)
      .bindPopup(`<strong>${caso.titulo}</strong><br>${local}<br>Status: ${caso.status}`);
  }
}async function exibirMapaDeCasos(casos) {
  const mapaContainer = document.getElementById('mapaCasos');
  if (!mapaContainer) return;

  // Remove mapa anterior, se já existir
  if (window._mapaInstancia) {
    window._mapaInstancia.remove();
  }

  const mapa = L.map('mapaCasos').setView([-14.2350, -51.9253], 4);
  window._mapaInstancia = mapa;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(mapa);

  const geocodeCache = {};

  for (const caso of casos) {
    const local = caso.local?.trim();
    if (!local) continue;

    let coords = geocodeCache[local];

    if (!coords) {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(local)}`, {
          headers: { 'User-Agent': 'ODONTOCRIM Dashboard' }
        });

        const data = await response.json();
        if (data.length > 0) {
          coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          geocodeCache[local] = coords;
        } else {
          console.warn('Local não encontrado:', local);
          continue;
        }
      } catch (error) {
        console.error('Erro ao buscar coordenadas de:', local, error);
        continue;
      }
    }

    // Adiciona marcador com título, local, status e ID
    const popupContent = `
      <strong>${caso.numeroCaso}</strong><br>
      Título: ${caso.titulo}<br>
      Local: ${local}<br>
      Status: ${caso.status}<br>
      
    `;

            const redIcon = new L.Icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });

        L.marker(coords, { icon: redIcon }).addTo(mapa).bindPopup(popupContent);

  }
}

async function carregarTotalEvidencias(token) {
  try {
    const response = await fetch('https://odontoforense-backend.onrender.com/api/evidencias?limit=1000', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    const evidencias = result.data.docs || result.data;

    const cards = document.querySelectorAll('.card-counter h1');
    if (cards.length > 1) {
      cards[1].textContent = evidencias.length;
    }
  } catch (err) {
    console.error('Erro ao carregar evidências:', err);
  }
}

function gerarGraficosVitimas(casos) {
  // Inicializar dados
  dadosGenero = {
    masculino: 0,
    feminino: 0,
    outro: 0,
    'nao informado': 0
  };

  dadosIdade = {
    bebe: 0,
    crianca: 0,
    adolescente: 0,
    adulta: 0,
    idosa: 0,
    nao_informado: 0
  };

  // Contar vítimas (com verificação mais robusta)
  casos.forEach(caso => {
    if (!caso.vitimas || !Array.isArray(caso.vitimas)) return;
    
    caso.vitimas.forEach(v => {
      const genero = (v.genero || 'nao informado').toLowerCase().trim();
      const idade = (v.idade || 'nao_informado').toLowerCase().trim();

      if (dadosGenero[genero] !== undefined) dadosGenero[genero]++;
      if (dadosIdade[idade] !== undefined) dadosIdade[idade]++;
    });
  });

  console.log('Dados Gênero:', dadosGenero); // Debug
  console.log('Dados Idade:', dadosIdade);   // Debug

  // Atualizar contador total de vítimas
  const cards = document.querySelectorAll('.card-counter h1');
  if (cards.length > 3) {
    const totalVitimas = casos.reduce((total, caso) => total + (caso.vitimas?.length || 0), 0);
    cards[3].textContent = totalVitimas;
  }

  // Verificar se o canvas existe antes de criar o gráfico
  const canvas = document.getElementById('graficoVitimas');
  if (!canvas) {
    console.error('Elemento canvas não encontrado!');
    return;
  }

  // Criar gráfico inicial (gênero)
  criarGraficoVitimas('genero');

  // Configurar botões de alternância (com verificação de existência)
  const btnGenero = document.getElementById('btnGenero');
  const btnIdade = document.getElementById('btnIdade');
  
  if (btnGenero && btnIdade) {
    btnGenero.addEventListener('click', () => {
      btnGenero.classList.add('active');
      btnIdade.classList.remove('active');
      criarGraficoVitimas('genero');
    });

    btnIdade.addEventListener('click', () => {
      btnIdade.classList.add('active');
      btnGenero.classList.remove('active');
      criarGraficoVitimas('idade');
    });
  }
}

function criarGraficoVitimas(tipo) {
  const ctx = document.getElementById('graficoVitimas')?.getContext('2d');
  if (!ctx) {
    console.error('Contexto do canvas não encontrado');
    return;
  }

  // Destruir gráfico anterior apenas se existir e for válido
  if (window.graficoVitimas && typeof window.graficoVitimas.destroy === 'function') {
    window.graficoVitimas.destroy();
  }

  if (tipo === 'genero') {
  // Filtra apenas masculino, feminino e não informado
  const generoFiltrado = ['masculino', 'feminino', 'nao informado'];
  const labels = generoFiltrado.map(key => 
    key === 'masculino' ? 'Masculino' :
    key === 'feminino' ? 'Feminino' : 'Não informado'
  );
  const data = generoFiltrado.map(key => dadosGenero[key] || 0);

  graficoVitimas = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Vítimas por Gênero',
        data,
        backgroundColor: ['#198754', '#fd7e14', '#dc3545'], // verde, laranja, cinza
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
  y: {
    title: {
      display: true,
      text: 'Quantidade',
      color: '#153777',
      font: {
        size: 14,
        weight: 'bold'
      }
    },
    ticks: {
      font: {
        size: 12
      }
    }
  },
  x: {
    title: {
      display: true,
      text: 'Gênero',
      color: '#153777',
      font: {
        size: 14,
        weight: 'bold'
      }
    },
    ticks: {
      font: {
        size: 12
      }
    }
  }
}

    }
  });
} else {
  // Filtra todas menos "nao_informado"
  const ordemIdade = ['bebe', 'crianca', 'adolescente', 'adulta', 'idosa'];
  const labels = ordemIdade.map(key =>
    key === 'bebe' ? 'Bebê' :
    key === 'crianca' ? 'Criança' :
    key === 'adolescente' ? 'Adolescente' :
    key === 'adulta' ? 'Adulta' : 'Idosa'
  );
  const data = ordemIdade.map(key => dadosIdade[key] || 0);

  graficoVitimas = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Vítimas por Idade',
        data,
        backgroundColor: [
          '#198754', // Bebê - verde
          '#fd7e14', // Criança - laranja
          '#dc3545', // Adolescente - vermelho
          '#0d6efd', // Adulta - azul
          '#6f42c1'  // Idosa - roxo
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
  y: {
    title: {
      display: true,
      text: 'Quantidade',
      color: '#153777',
      font: {
        size: 14,
        weight: 'bold'
      }
    },
    ticks: {
      font: {
        size: 12
      }
    }
  },
  x: {
    title: {
      display: true,
      text: 'Faixa Etária',
      color: '#153777',
      font: {
        size: 14,
        weight: 'bold'
      }
    },
    ticks: {
      font: {
        size: 12
      }
    }
  }
}

    }
  });
}

}
