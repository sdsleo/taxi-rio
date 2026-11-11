import React, { useState, useEffect, useCallback } from 'react';
import { RideStatus, UserRole, IRide } from '@taxi-rio/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface TokenResponse {
  message?: string;
  passenger?: {
    userId: string;
    role: string;
    name: string;
    token: string;
  };
  driver?: {
    userId: string;
    role: string;
    name: string;
    token: string;
  };
  passengerToken?: string;
  driverToken?: string;
}

export const App: React.FC = () => {
  const [role, setRole] = useState<UserRole>(UserRole.PASSENGER);
  const [tokens, setTokens] = useState<TokenResponse | null>(null);
  const [customToken, setCustomToken] = useState<string>('');

  // Formulário do Passageiro
  const [origemEndereco, setOrigemEndereco] = useState<string>('Av. Atlântica, Copacabana');
  const [origemLat, setOrigemLat] = useState<number>(-22.9711);
  const [origemLng, setOrigemLng] = useState<number>(-43.1822);

  const [destinoEndereco, setDestinoEndereco] = useState<string>('Praça Mauá, Centro');
  const [destinoLat, setDestinoLat] = useState<number>(-22.8967);
  const [destinoLng, setDestinoLng] = useState<number>(-43.1804);

  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  const [autoRegenerateKey, setAutoRegenerateKey] = useState<boolean>(true);

  // Visão do Motorista
  const [searchRideId, setSearchRideId] = useState<string>('');
  const [selectedRide, setSelectedRide] = useState<IRide | null>(null);

  // Histórico e Notificações
  const [myRides, setMyRides] = useState<IRide[]>([]);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Busca tokens de teste gerados pela API
  const fetchTokens = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/tokens`);
      if (response.ok) {
        const data = (await response.json()) as TokenResponse;
        setTokens(data);
      }
    } catch {
      // Falha silenciosa caso API ainda não esteja respondendo
    }
  }, []);

  useEffect(() => {
    void fetchTokens();
  }, [fetchTokens]);

  const activeToken = customToken
    ? customToken
    : role === UserRole.PASSENGER
      ? tokens?.passenger?.token || tokens?.passengerToken || ''
      : tokens?.driver?.token || tokens?.driverToken || '';

  // Carregar lista de corridas se logado
  const fetchRidesList = useCallback(async () => {
    if (!activeToken) return;
    try {
      const response = await fetch(`${API_BASE_URL}/corridas`, {
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
      });
      if (response.ok) {
        const rides = (await response.json()) as IRide[];
        setMyRides(rides);
      }
    } catch {
      // Ignora erro em polling simples
    }
  }, [activeToken]);

  useEffect(() => {
    void fetchRidesList();
  }, [fetchRidesList, role]);

  const handleCreateRide = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);
    setLoading(true);

    try {
      const keyToUse = idempotencyKey.trim() || crypto.randomUUID();
      const response = await fetch(`${API_BASE_URL}/corridas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
          'Idempotency-Key': keyToUse,
        },
        body: JSON.stringify({
          origin: {
            address: origemEndereco,
            latitude: Number(origemLat),
            longitude: Number(origemLng),
          },
          destination: {
            address: destinoEndereco,
            latitude: Number(destinoLat),
            longitude: Number(destinoLng),
          },
        }),
      });

      const isReplay = response.headers.get('x-idempotent-replay') === 'true';
      const data = (await response.json()) as { message?: string } & Partial<IRide>;

      if (!response.ok) {
        setNotification({
          type: 'error',
          message: `Erro (${response.status}): ${data.message || JSON.stringify(data)}`,
        });
        return;
      }

      const ride = data as IRide;
      setNotification({
        type: 'success',
        message: isReplay
          ? `Corrida retornada do cache de idempotência (Replay detectado)! ID: ${ride.id}`
          : `Corrida solicitada com sucesso! ID: ${ride.id}`,
      });

      setMyRides((prev) => {
        const exists = prev.some((r) => r.id === ride.id);
        if (exists) {
          return prev.map((r) => (r.id === ride.id ? ride : r));
        }
        return [ride, ...prev];
      });

      if (autoRegenerateKey) {
        setIdempotencyKey(crypto.randomUUID());
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: `Falha na requisição: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchRide = async (rideIdToSearch?: string) => {
    const id = rideIdToSearch || searchRideId.trim();
    if (!id) return;

    setNotification(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/corridas/${id}`, {
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
      });

      const data = (await response.json()) as { message?: string } & Partial<IRide>;

      if (!response.ok) {
        setNotification({
          type: 'error',
          message: `Erro (${response.status}): ${data.message || JSON.stringify(data)}`,
        });
        setSelectedRide(null);
        return;
      }

      const ride = data as IRide;
      setSelectedRide(ride);
      setMyRides((prev) => {
        const filtered = prev.filter((r) => r.id !== ride.id);
        return [ride, ...filtered];
      });
    } catch (err) {
      setNotification({
        type: 'error',
        message: `Falha ao buscar corrida: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (rideId: string, nextStatus: RideStatus) => {
    setNotification(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/corridas/${rideId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = (await response.json()) as { message?: string } & Partial<IRide>;

      if (!response.ok) {
        setNotification({
          type: 'error',
          message: `Erro (${response.status}): ${data.message || JSON.stringify(data)}`,
        });
        return;
      }

      const updatedRide = data as IRide;
      setNotification({
        type: 'success',
        message: `Status atualizado para ${nextStatus}!`,
      });

      if (selectedRide?.id === rideId) {
        setSelectedRide(updatedRide);
      }

      setMyRides((prev) => prev.map((r) => (r.id === rideId ? updatedRide : r)));
    } catch (err) {
      setNotification({
        type: 'error',
        message: `Falha ao atualizar status: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div>
          <h1>Taxi.Rio — Mobilidade Urbana</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#718096' }}>
            Prefeitura da Cidade do Rio de Janeiro
          </p>
        </div>
        <div>
          <span className="badge" style={{ backgroundColor: '#e2e8f0', color: '#2d3748' }}>
            Ambiente Local
          </span>
        </div>
      </header>

      {/* Seletor de Perfil & Autenticação */}
      <section className="card">
        <h2>Autenticação e Perfil de Acesso</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
          <strong>Perfil Ativo:</strong>
          <button
            type="button"
            className={`btn ${role === UserRole.PASSENGER ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRole(UserRole.PASSENGER)}
          >
            Passageiro (PASSENGER)
          </button>
          <button
            type="button"
            className={`btn ${role === UserRole.DRIVER ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRole(UserRole.DRIVER)}
          >
            Motorista (DRIVER)
          </button>
        </div>

        <div className="form-group">
          <label htmlFor="token-input">JWT Token Utilizado:</label>
          <input
            id="token-input"
            className="form-control"
            value={activeToken}
            onChange={(e) => setCustomToken(e.target.value)}
            placeholder="Cole um token JWT ou use o token automático pré-gerado..."
          />
          <small style={{ color: '#718096', fontSize: '0.75rem' }}>
            Tokens pré-gerados via <code>GET /auth/tokens</code> da API.
          </small>
        </div>
      </section>

      {/* Notificações / Erros */}
      {notification && (
        <div
          className={`alert ${notification.type === 'success' ? 'alert-success' : 'alert-error'}`}
        >
          {notification.message}
        </div>
      )}

      {/* Visão do Passageiro */}
      {role === UserRole.PASSENGER && (
        <section className="card">
          <h2>Solicitar Nova Corrida (Passageiro)</h2>
          <form onSubmit={handleCreateRide}>
            <div className="form-group">
              <label htmlFor="origem-endereco">Endereço de Origem:</label>
              <input
                id="origem-endereco"
                className="form-control"
                value={origemEndereco}
                onChange={(e) => setOrigemEndereco(e.target.value)}
                required
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <input
                  type="number"
                  step="0.0001"
                  className="form-control"
                  placeholder="Latitude"
                  value={origemLat}
                  onChange={(e) => setOrigemLat(Number(e.target.value))}
                  required
                />
                <input
                  type="number"
                  step="0.0001"
                  className="form-control"
                  placeholder="Longitude"
                  value={origemLng}
                  onChange={(e) => setOrigemLng(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="destino-endereco">Endereço de Destino:</label>
              <input
                id="destino-endereco"
                className="form-control"
                value={destinoEndereco}
                onChange={(e) => setDestinoEndereco(e.target.value)}
                required
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <input
                  type="number"
                  step="0.0001"
                  className="form-control"
                  placeholder="Latitude"
                  value={destinoLat}
                  onChange={(e) => setDestinoLat(Number(e.target.value))}
                  required
                />
                <input
                  type="number"
                  step="0.0001"
                  className="form-control"
                  placeholder="Longitude"
                  value={destinoLng}
                  onChange={(e) => setDestinoLng(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="idempotency-key">Chave de Idempotência (Idempotency-Key):</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  id="idempotency-key"
                  className="form-control"
                  value={idempotencyKey}
                  onChange={(e) => setIdempotencyKey(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIdempotencyKey(crypto.randomUUID())}
                >
                  Novo UUID
                </button>
              </div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '0.5rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={autoRegenerateKey}
                  onChange={(e) => setAutoRegenerateKey(e.target.checked)}
                />
                <span style={{ fontSize: '0.8rem', color: '#4a5568' }}>
                  Gerar nova chave automaticamente após envio (desmarque para testar replay de
                  idempotência)
                </span>
              </label>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Enviando...' : 'Pedir Corrida'}
            </button>
          </form>
        </section>
      )}

      {/* Visão do Motorista */}
      {role === UserRole.DRIVER && (
        <section className="card">
          <h2>Gerenciamento de Corridas (Motorista)</h2>
          <div className="form-group">
            <label htmlFor="search-ride">ID da Corrida para Acompanhar / Aceitar:</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="search-ride"
                className="form-control"
                value={searchRideId}
                onChange={(e) => setSearchRideId(e.target.value)}
                placeholder="Ex: 123e4567-e89b-12d3-a456-426614174000"
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleSearchRide()}
                disabled={loading || !searchRideId.trim()}
              >
                Buscar
              </button>
            </div>
          </div>

          {selectedRide && (
            <div className="ride-item" style={{ marginTop: '1rem', backgroundColor: '#f7fafc' }}>
              <div className="ride-header">
                <strong>Corrida: {selectedRide.id}</strong>
                <span className={`badge badge-${selectedRide.status}`}>{selectedRide.status}</span>
              </div>
              <div className="ride-details">
                <p>
                  <strong>Origem:</strong>{' '}
                  {selectedRide.origin?.address ||
                    `${selectedRide.origin.latitude}, ${selectedRide.origin.longitude}`}{' '}
                  &rarr; <strong>Destino:</strong>{' '}
                  {selectedRide.destination?.address ||
                    `${selectedRide.destination.latitude}, ${selectedRide.destination.longitude}`}
                </p>
                <p>
                  <strong>Preço:</strong> R$ {Number(selectedRide.price).toFixed(2)}
                </p>
                {selectedRide.driverId && (
                  <p>
                    <strong>Motorista ID:</strong> {selectedRide.driverId}
                  </p>
                )}
              </div>

              <div className="btn-group">
                {selectedRide.status === RideStatus.REQUESTED && (
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => void handleUpdateStatus(selectedRide.id, RideStatus.ACCEPTED)}
                    disabled={loading}
                  >
                    Aceitar Corrida (ACCEPTED)
                  </button>
                )}
                {selectedRide.status === RideStatus.ACCEPTED && (
                  <button
                    type="button"
                    className="btn btn-warning"
                    onClick={() => void handleUpdateStatus(selectedRide.id, RideStatus.IN_PROGRESS)}
                    disabled={loading}
                  >
                    Iniciar Corrida (IN_PROGRESS)
                  </button>
                )}
                {selectedRide.status === RideStatus.IN_PROGRESS && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleUpdateStatus(selectedRide.id, RideStatus.COMPLETED)}
                    disabled={loading}
                  >
                    Concluir Corrida (COMPLETED)
                  </button>
                )}
                {selectedRide.status === RideStatus.COMPLETED && (
                  <span style={{ color: '#22543d', fontWeight: 600 }}>
                    Corrida Finalizada com Sucesso!
                  </span>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Histórico da Sessão */}
      <section className="card">
        <h2>Corridas Disponíveis ({myRides.length})</h2>
        {myRides.length === 0 ? (
          <p style={{ color: '#718096', fontSize: '0.9rem' }}>Nenhuma corrida encontrada.</p>
        ) : (
          <div>
            {myRides.map((ride) => (
              <div key={ride.id} className="ride-item">
                <div className="ride-header">
                  <div>
                    <strong>
                      {ride.origin?.address || `${ride.origin.latitude}, ${ride.origin.longitude}`}{' '}
                      &rarr;{' '}
                      {ride.destination?.address ||
                        `${ride.destination.latitude}, ${ride.destination.longitude}`}
                    </strong>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>ID: {ride.id}</div>
                  </div>
                  <span className={`badge badge-${ride.status}`}>{ride.status}</span>
                </div>
                <div className="ride-details">
                  <span>Preço Estimado: R$ {Number(ride.price).toFixed(2)}</span>
                </div>
                <div className="btn-group" style={{ marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    onClick={() => {
                      setSearchRideId(ride.id);
                      void handleSearchRide(ride.id);
                    }}
                  >
                    Recarregar Detalhes
                  </button>
                  {role === UserRole.DRIVER && ride.status === RideStatus.REQUESTED && (
                    <button
                      type="button"
                      className="btn btn-success"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => void handleUpdateStatus(ride.id, RideStatus.ACCEPTED)}
                    >
                      Aceitar
                    </button>
                  )}
                  {role === UserRole.DRIVER && ride.status === RideStatus.ACCEPTED && (
                    <button
                      type="button"
                      className="btn btn-warning"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => void handleUpdateStatus(ride.id, RideStatus.IN_PROGRESS)}
                    >
                      Iniciar
                    </button>
                  )}
                  {role === UserRole.DRIVER && ride.status === RideStatus.IN_PROGRESS && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => void handleUpdateStatus(ride.id, RideStatus.COMPLETED)}
                    >
                      Concluir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default App;
