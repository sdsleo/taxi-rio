import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// Métricas Customizadas
const rideCreationDuration = new Trend('ride_creation_duration_ms');
const replayCounter = new Counter('idempotent_replays_total');
const successRate = new Rate('successful_requests_rate');

// Configuração de Carga e Limiares (Thresholds)
export const options = {
  stages: [
    { duration: '20s', target: 20 }, // Rampa de subida
    { duration: '40s', target: 50 }, // Carga nominal sustentada
    { duration: '20s', target: 100 }, // Pico de estresse concorrente
    { duration: '20s', target: 0 }, // Rampa de descida
  ],
  thresholds: {
    // 95% das requisições devem responder em menos de 500ms; 99% em menos de 1000ms
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    // Taxa de falha de requisições HTTP inferior a 1%
    http_req_failed: ['rate<0.01'],
    // Taxa de sucesso das validações (checks) superior a 99%
    successful_requests_rate: ['rate>0.99'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

// Função para gerar UUIDv4 em k6
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Bairros e coordenadas de referência no Rio de Janeiro
const BAIRROS_RIO = [
  { nome: 'Copacabana', lat: -22.9711, lng: -43.1822 },
  { nome: 'Centro', lat: -22.9068, lng: -43.1729 },
  { nome: 'Barra da Tijuca', lat: -23.0003, lng: -43.3659 },
  { nome: 'Ipanema', lat: -22.9868, lng: -43.2046 },
  { nome: 'Tijuca', lat: -22.9242, lng: -43.2322 },
  { nome: 'Botafogo', lat: -22.9519, lng: -43.1843 },
];

export function setup() {
  // Obter tokens de teste gerados pela API
  const tokenRes = http.get(`${BASE_URL}/auth/tokens`);
  if (tokenRes.status === 200) {
    const data = JSON.parse(tokenRes.body);
    return {
      passengerToken: data.passenger.token,
      driverToken: data.driver.token,
    };
  }

  // Fallback seguro caso /auth/tokens não responda no setup inicial
  return {
    passengerToken: 'fallback_token',
    driverToken: 'fallback_token',
  };
}

export default function (data) {
  const passengerToken = data.passengerToken;
  const driverToken = data.driverToken;

  const origemIndex = Math.floor(Math.random() * BAIRROS_RIO.length);
  let destinoIndex = Math.floor(Math.random() * BAIRROS_RIO.length);
  if (destinoIndex === origemIndex) {
    destinoIndex = (origemIndex + 1) % BAIRROS_RIO.length;
  }

  const origem = BAIRROS_RIO[origemIndex];
  const destino = BAIRROS_RIO[destinoIndex];
  const idempotencyKey = generateUUID();
  const correlationId = generateUUID();

  const createRidePayload = JSON.stringify({
    origin: {
      latitude: origem.lat,
      longitude: origem.lng,
      address: origem.nome,
    },
    destination: {
      latitude: destino.lat,
      longitude: destino.lng,
      address: destino.nome,
    },
  });

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${passengerToken}`,
    'Idempotency-Key': idempotencyKey,
    'X-Correlation-ID': correlationId,
  };

  // 1. Solicitação de Corrida (POST /corridas)
  const startTime = new Date();
  const resCreate = http.post(`${BASE_URL}/corridas`, createRidePayload, { headers });
  rideCreationDuration.add(new Date() - startTime);

  const createOk = check(resCreate, {
    'POST /corridas status é 201': (r) => r.status === 201,
    'POST /corridas possui ID válido': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && body.id !== undefined && body.status === 'REQUESTED';
      } catch {
        return false;
      }
    },
    'POST /corridas propaga correlation-id': (r) =>
      r.headers['X-Correlation-Id'] !== undefined || r.headers['x-correlation-id'] !== undefined,
  });

  successRate.add(createOk);

  let rideId = null;
  if (resCreate.status === 201) {
    try {
      rideId = JSON.parse(resCreate.body).id;
    } catch {
      // Ignora erro de parse
    }
  }

  // 2. Teste de Idempotência (Reenvio com mesma chave para 10% das requisições)
  if (Math.random() < 0.1) {
    const resReplay = http.post(`${BASE_URL}/corridas`, createRidePayload, { headers });
    const isReplay = check(resReplay, {
      'Idempotent Replay status é 201': (r) => r.status === 201,
      'Idempotent Replay contém header X-Idempotent-Replay': (r) =>
        r.headers['X-Idempotent-Replay'] === 'true' || r.headers['x-idempotent-replay'] === 'true',
    });
    if (isReplay) {
      replayCounter.add(1);
    }
  }

  // 3. Leitura e Verificação de Cache (GET /corridas/:id)
  if (rideId) {
    const resGet = http.get(`${BASE_URL}/corridas/${rideId}`, {
      headers: {
        Authorization: `Bearer ${passengerToken}`,
      },
    });

    const getOk = check(resGet, {
      'GET /corridas/:id status é 200': (r) => r.status === 200,
      'GET /corridas/:id retorna a mesma corrida': (r) => {
        try {
          return JSON.parse(r.body).id === rideId;
        } catch {
          return false;
        }
      },
    });
    successRate.add(getOk);

    // 4. Aceitação da Corrida por Motorista (PATCH /corridas/:id/status)
    const resAccept = http.patch(
      `${BASE_URL}/corridas/${rideId}/status`,
      JSON.stringify({ status: 'ACCEPTED' }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${driverToken}`,
          'X-Correlation-ID': generateUUID(),
        },
      },
    );

    const acceptOk = check(resAccept, {
      'PATCH /corridas/:id/status aceito com 200': (r) => r.status === 200,
      'PATCH status atualizado para ACCEPTED': (r) => {
        try {
          return JSON.parse(r.body).status === 'ACCEPTED';
        } catch {
          return false;
        }
      },
    });
    successRate.add(acceptOk);
  }

  // Pausa realista entre ações (500ms a 1500ms)
  sleep(0.5 + Math.random());
}
